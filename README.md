# api-grabber
A GitHub action which grabs data from certain APIs or any urls you want, parses it, and then saves the parsed data to the specified location.

## Input
Takes one parameter, `options` as an input. This is the path to the options json file which controls how the action should work.

## Options File

The options json file is formatted as follows:
```json
{
    "someFileName.json": [
        {
            "url": "someUrl",
            "values": {
                "someValueName": {
                    "storeField": "someField",
                    "storeAs": "number"
                },
                "someOtherValueName": {
                    "parseStart": "bob",
                    "parseEnd": ","
                },
            }
        },
        {
            "url": "anotherUrl",
            "values": {
                "rawData": {
                    "storeAs": "string"
                },
            }
        }
    ]
}
```

Each file can have as many urls and values as you need.

## Values
Values have several parameters: `parseStart`, `parseEnd`, `storeField`, and `storeAs`.

If you provided none of them, just the default content will be stored. 

`parseStart` defines where to start the string, such as at "playing" if you wanted to parse everything afterwards. `parseEnd` defines where to end the string, such as "," to end at the next comma. If you don't provide an end, everything after the start is included.

`storeField` attempts to parse the content as JSON, and then stores the respective field. Slashes (/) are used as a separator.

`storeAs` is how the data will be stored. The default is `string`, but if you set `storeAs` to `number` it will be stored as a number instead.

# Examples
Say we had an api url like "someapi.com" which contains the following data:
```json
{
    "data": [
        {
            "id": 640204840,
            "upVotes": 174892,
            "downVotes": 28808
        }
    ]
}
```

Here's what an example options file would look like:
```json
{
    "whereTheFileWillBeStored.json": [
        {
            "url": "someapi.com",
            "values": {
                "Likes": {
                    "storeField": "data/0/upVotes",
                    "storeAs": "number"
                },
                "Dislikes": {
                    "storeField": "data/0/downVotes",
                    "storeAs": "number"
                }
            }
        }
    ]
}
```

Additionally, the following options file would yield the same output:
```json
{
    "whereTheFileWillBeStored.json": [
        {
            "url": "someapi.com",
            "values": {
                "Likes": {
                    "parseStart": "\"upVotes\":",
                    "parseEnd": ",",
                    "storeAs": "number"
                },
                "Dislikes": {
                    "parseStart": "\"downVotes\":",
                    "parseEnd": "}",
                    "storeAs": "number"
                }
            }
        }
    ]
}
```

Both of them would cause a file called `whereTheFileWillBeStored.json` to be written with the data:
```json
{"Likes":174892,"Dislikes":28808}
```

# Working Example
For a working example, see the example repository below:
https://github.com/ThatTimothy/live-stats
