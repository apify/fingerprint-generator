const fs = require('fs');
const path = require('path');
const parse = require('csv-parse/lib/sync');

const datasetPath = path.join(__dirname, "./dataset.csv");
const arrayIndexRegexp = /^\d+\/{0,1}/;

function getRandomInteger(minimum, maximum) {
    return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

/*
 * This function is needed because saving the dataset in the CSV format leads to objects with attribute names like audioCodecs/mp3 or languages/0.
 * These have to be decoded back to the JSON structure before they can be used.
 */
function recursivelyRestoreJSONStructure(squashedObject) {
    const recurseOn = new Set();
    let restoredJSON = {};
    let objectIsArray = Array.isArray(squashedObject);
    if(objectIsArray) {
        restoredJSON = new Array(squashedObject.length);
    }

    for(const attribute in squashedObject) {
        let attributeToSplit = attribute;
        let value = squashedObject[attribute];
        if(objectIsArray) {
            attributeToSplit = squashedObject[attribute][0];
            value = squashedObject[attribute][1];
        }

        if(!attribute.includes("/")) {
            restoredJSON[attribute] = value;
        } else {            
            let [ prefix, body, emptyString ] = attributeToSplit.split(/\/(.*)/);
            
            let attributeIsArray = false;
            if(body.match(arrayIndexRegexp)) {
                attributeIsArray = true;
                body = body.replace(arrayIndexRegexp, "");
            }

            if(!recurseOn.has(prefix)) {
                if(attributeIsArray) {
                    restoredJSON[prefix] = [];
                } else {
                    restoredJSON[prefix] = {};
                }
            }

            if(attributeIsArray) {
                restoredJSON[prefix].push([body, value]);
            } else {
                restoredJSON[prefix][body] = value;
            }
            recurseOn.add(prefix);
        }
    }

    for(const attribute of recurseOn) {
        restoredJSON[attribute] = recursivelyRestoreJSONStructure(restoredJSON[attribute]);
    }

    return restoredJSON;
}

/**
 * Fingerprint generator - randomly generates realistic browser fingerprints
 */
class FingerprintGenerator {

    constructor() {
        const datasetText = fs.readFileSync(datasetPath, {encoding:'utf8'}).replace(/^\ufeff/, '');
        const records = parse(datasetText, {
            columns: true,
            skip_empty_lines: true
        });
        
        this.fingerprints = {};
        for(const record of records) {
            let userAgent = record["browserFingerprint/userAgent"];
            let fingerprint = {};
            for(const datasetAttribute of Object.keys(record)) {
                const attribute = datasetAttribute.replace("www.", "").replace("browserFingerprint/", "");
                if(record[datasetAttribute] !== "")
                    fingerprint[attribute] = record[datasetAttribute];
            }
            if(!(userAgent in this.fingerprints)) {
                this.fingerprints[userAgent] = [];
            }

            this.fingerprints[userAgent].push(fingerprint);
        }
    }

    /**
     * Generates a browser fingerprint consistent with the provided request headers
     * @param {Object} requestHeaders - headers
     */
    getFingerprint(requestHeaders) {
        let userAgent = requestHeaders["user-agent"];
        if(!userAgent) {
            userAgent = requestHeaders["User-Agent"];
        }

        if(!userAgent || !(userAgent in this.fingerprints)) {
            throw new Error('No fingerprint can be generated for these headers.');
        }

        const fingerprintCandidates = this.fingerprints[userAgent];

        const fingerprint = fingerprintCandidates[getRandomInteger(0, fingerprintCandidates.length - 1)];
        return recursivelyRestoreJSONStructure(fingerprint);
    }
}

module.exports = FingerprintGenerator;
