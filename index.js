const core = require('@actions/core')
const github = require('@actions/github')
const https = require('https')
const fs = require('fs')

function exitWithError(message) {
    core.setOutput('success', false)
    core.setFailed(message)
    console.error(message)
    process.exit(1)
}

function exitSuccessfully() {
    core.setOutput('success', true)
    process.exit(0)
}

const optionsDir = core.getInput("options") || "options.json";

let optionsRawContent
try {
    optionsRawContent = fs.readFileSync(optionsDir, 'utf8')
} catch (error) {
    exitWithError(`Failed to read specified options file at '${optionsDir}!`)
}

let options = JSON.parse(optionsRawContent)

let urlsToGet = []

let filesToWrite = 0;
for (const name in options) {
    const items = options[name]
    if (!items || items.length === 0) {
        exitWithError(`'${name}' does not have any items!`)
    }

    filesToWrite++;

    for (const item of items) {
        const url = item.url

        if (!url) {
            exitWithError(`'${name}' contains an item without a url field!`)
        }

        if (!item.values) {
            exitWithError(`'${name}' contains an item without a values field!`)
        }

        if (!urlsToGet.includes(url)) {
            urlsToGet.push(url)
        }
    }
}

function writeToFiles(dataToWrite) {
    let filesWritten = 0;
    //Write to all files
    for (const name in dataToWrite) {
        const data = dataToWrite[name]

        //Transforms someDir/fileName.json -> someDir
        let withoutFile = name.split('/')
        withoutFile.pop()
        withoutFile = withoutFile.join("/")

        //Add folder if it doesn't exist
        if (withoutFile.length > 0 && !fs.existsSync(withoutFile)) {
            fs.mkdirSync(withoutFile)
        }

        //Write the file
        fs.writeFile(name, data, (error) => {
            if (!error) {
                //Success!
                filesWritten++;
                console.log(`Wrote to file '${name}'. (${filesWritten}/${filesToWrite})`)

                //Check for completion
                if (filesWritten >= filesToWrite) {
                    console.log(`Performed all operations successfully!`)
                    exitSuccessfully()
                }
            } else {
                exitWithError(error)
            }
        })
    }
}

let urlsGotten = 0
let urlsContent = []

function handleAllUrls() {
    let dataToWrite = {}

    let i = 0;
    for (const name in options) {
        const items = options[name]
        let result = {}
        
        for (const item of items) {

            const values = item.values
            for (const valueName in values) {

                const value = values[valueName]
                const content = urlsContent[item.url]

                let toStore = 'null'

                //Do parsing
                if (value.parseStart) {
                    //Raw parsing based on finding a certain string start and end
                    const firstIndex = content.indexOf(value.parseStart) + value.parseStart.length
                    const firstPart = content.substring(firstIndex)
                    const secondIndex = (value.parseEnd && firstPart.indexOf(value.parseEnd)) || firstPart.length
                    const parsedValue = firstPart.substring(0, secondIndex)

                    toStore = parsedValue
                } else if (value.storeField) {
                    //Store a certain field
                    const fields = value.storeField.split("/")
                    let storing = JSON.parse(content)
                    for (let field of fields) {
                        const previous = storing
                        storing = storing[field]
                        
                        //Check if the field doesn't exist
                        if (storing === undefined || storing === null) {
                            let possibleFields = ""

                            for (let key in previous) {
                                if (possibleFields === "") {
                                    possibleFields = `'${key}'`
                                } else {
                                    possibleFields += `, '${key}'`
                                }
                            }

                            const message = `Cannot find field '${field}' when searching for '${value.storeField}' in response of '${item.url}'. ` +
                                `Available fields: ${possibleFields}`
                            exitWithError(message)
                        }
                    }

                    toStore = JSON.stringify(storing)
                } else {
                    //Just store everything
                    toStore = content
                }

                //Convert to various types
                if (value.storeAs === 'number') {
                    toStore = parseFloat(toStore)
                }

                //Store value in result
                result[valueName] = toStore
            }
        }

        //Log parsing for this file happened
        i++;
        console.log(`Parsed data for file '${name}'. (${i}/${filesToWrite})`)

        //Store data to write
        dataToWrite[name] = JSON.stringify(result)
    }

    //Write the parsed data to files
    writeToFiles(dataToWrite)
}

for (const url of urlsToGet) {
    console.log(`Requesting '${url}'...`)

    //Request each url
    https.get(url, (res) => {

        let data = ""

        //Connect handler to when bits of data are retrieved
        res.on('data', (d) => {
            data += d;
        })

        //Connect handler to when all bits of data are available
        res.on('end', () => {
            //Mark url as gotten
            urlsGotten++;

            //Get the status code
            const statusCode = res.statusCode;

            //Ignore statuses below 200
            if (statusCode < 200) {return} 

            //Log the response
            console.log(`Response from '${url}', status code ${statusCode}. (${urlsGotten}/${urlsToGet.length})`)

            //Check for a status code which is invalid
            if (statusCode > 299) {
                exitWithError(`Request to '${url}' failed with code ${statusCode}, response body: ${data}`)
            }

            //Save retrieved data
            urlsContent[url] = data

            //Check for all urls gotten, if so move on
            if (urlsGotten >= urlsToGet.length) {
                handleAllUrls()
            }
        })
    }).on('error', (error) => {
        exitWithError(error.message);
    })
}