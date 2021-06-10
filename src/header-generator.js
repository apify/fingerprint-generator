const { BayesianNetwork } = require('bayesian-network');
const { default: ow } = require('ow');

const BROWSER_HTTP_NODE_NAME = '*BROWSER_HTTP';
const OPERATING_SYSTEM_NODE_NAME = '*OPERATING_SYSTEM';
const DEVICE_NODE_NAME = '*DEVICE';

const MISSING_VALUE_DATASET_TOKEN = '*MISSING_VALUE*';

const headerNetworkDefinition = require('./data_files/header-network-definition.json');
const inputNetworkDefinition = require('./data_files/input-network-definition.json');
const headersOrder = require('./data_files/headers-order.json');
const uniqueBrowserStrings = require('./data_files/browser-helper-file.json');

const uniqueBrowsers = [];
for (const browserString of uniqueBrowserStrings) {
    // There are headers without user agents in the datasets we used to configure the generator. They should be disregarded.
    if (browserString !== MISSING_VALUE_DATASET_TOKEN) {
        uniqueBrowsers.push(prepareHttpBrowserObject(browserString));
    }
}

const http2SecFetchAttributes = {
    mode: 'sec-fetch-mode',
    dest: 'sec-fetch-dest',
    site: 'sec-fetch-site',
    user: 'sec-fetch-user',
};

const http1SecFetchAttributes = {
    mode: 'Sec-Fetch-Mode',
    dest: 'Sec-Fetch-Dest',
    site: 'Sec-Fetch-Site',
    user: 'Sec-Fetch-User',
};

/*
 * @private
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
}

/*
 * @private
 */
function browserVersionIsLesserOrEquals(browserVersionL, browserVersionR) {
    return browserVersionL[0] <= browserVersionR[0];
}

/**
 * Extract structured information about a browser and http version in the form of an object from httpBrowserString.
 * @param {string} httpBrowserString - a string containing the browser name, version and http version, such as "chrome/88.0.4324.182|2"
 * @private
 */
function prepareHttpBrowserObject(httpBrowserString) {
    const [browserString, httpVersion] = httpBrowserString.split('|');
    const browserObject = browserString === MISSING_VALUE_DATASET_TOKEN ? { name: MISSING_VALUE_DATASET_TOKEN } : prepareBrowserObject(browserString);
    return {
        ...browserObject,
        ...{
            httpVersion,
            completeString: httpBrowserString,
        },
    };
}

/**
 * Extract structured information about a browser in the form of an object from browserString.
 * @param {string} browserString - a string containing the browser name and version, such as "chrome/88.0.4324.182"
 * @private
 */
function prepareBrowserObject(browserString) {
    const nameVersionSplit = browserString.split('/');
    const versionSplit = nameVersionSplit[1].split('.');
    const preparedVersion = [];
    for (const versionPart of versionSplit) {
        preparedVersion.push(parseInt(versionPart, 10));
    }

    return {
        name: nameVersionSplit[0],
        version: preparedVersion,
        completeString: browserString,
    };
}

const browserSpecificationShape = {
    name: ow.string,
    minVersion: ow.optional.number,
    maxVersion: ow.optional.number,
    httpVersion: ow.optional.string,
};

const headerGeneratorOptionsShape = {
    browsers: ow.optional.array.ofType(ow.any(ow.object.exactShape(browserSpecificationShape), ow.string)),
    operatingSystems: ow.optional.array.ofType(ow.string),
    devices: ow.optional.array.ofType(ow.string),
    locales: ow.optional.array.ofType(ow.string),
    httpVersion: ow.optional.string,
};

/**
 * @typedef BrowserSpecification
 * @param {string} name - One of `chrome`, `firefox` and `safari`.
 * @param {number} minVersion - Minimal version of browser used.
 * @param {number} maxVersion - Maximal version of browser used.
 * @param {string} httpVersion - Http version to be used to generate headers (the headers differ depending on the version).
 *  Either 1 or 2. If none specified the httpVersion specified in `HeaderGeneratorOptions` is used.
 */
/**
 * @typedef HeaderGeneratorOptions
 * @param {Array<BrowserSpecification|string>} browsers - List of BrowserSpecifications to generate the headers for,
 *  or one of `chrome`, `firefox` and `safari`.
 * @param {Array<string>} operatingSystems - List of operating systems to generate the headers for.
 *  The options are `windows`, `macos`, `linux`, `android` and `ios`.
 * @param {Array<string>} devices - List of devices to generate the headers for. Options are `desktop` and `mobile`.
 * @param {Array<string>} locales - List of at most 10 languages to include in the
 *  [Accept-Language](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language) request header
 *  in the language format accepted by that header, for example `en`, `en-US` or `de`.
 * @param {string} httpVersion - Http version to be used to generate headers (the headers differ depending on the version).
 *  Can be either 1 or 2. Default value is 2.
 */

/**
 * HeaderGenerator randomly generates realistic browser headers based on specified options.
 */
class HeaderGenerator {
    /**
     * @param {HeaderGeneratorOptions} options - default header generation options used unless overridden
     */
    constructor(options = {}) {
        ow(options, 'HeaderGeneratorOptions', ow.object.exactShape(headerGeneratorOptionsShape));
        this.defaultOptions = JSON.parse(JSON.stringify(options));
        // Use a default setup when the necessary values are not provided
        if (!this.defaultOptions.locales) {
            this.defaultOptions.locales = ['en-US'];
        }
        if (!this.defaultOptions.httpVersion) {
            this.defaultOptions.httpVersion = '2';
        }
        if (!this.defaultOptions.browsers) {
            this.defaultOptions.browsers = [
                { name: 'chrome' },
                { name: 'firefox' },
                { name: 'safari' },
            ];
        }
        if (!this.defaultOptions.operatingSystems) {
            this.defaultOptions.operatingSystems = [
                'windows',
                'macos',
                'linux',
                'android',
                'ios',
            ];
        }

        this.inputGeneratorNetwork = new BayesianNetwork(inputNetworkDefinition);
        this.headerGeneratorNetwork = new BayesianNetwork(headerNetworkDefinition);
    }

    /**
     * Generates a single set of headers using a combination of the default options specified in the constructor
     * and their possible overrides provided here.
     * @param {HeaderGeneratorOptions} options - specifies options that should be overridden for this one call
     * @param {Object} requestDependentHeaders - specifies known values of headers dependent on the particular request
     */
    getHeaders(options = {}, requestDependentHeaders = {}) {
        ow(options, 'HeaderGeneratorOptions', ow.object.exactShape(headerGeneratorOptionsShape));
        const headerOptions = JSON.parse(JSON.stringify({ ...this.defaultOptions, ...options }));
        headerOptions.browsers = headerOptions.browsers.map((browserObject) => {
            if (typeof browserObject === 'string') {
                browserObject = { name: browserObject };
            }

            if (!browserObject.httpVersion) {
                browserObject.httpVersion = headerOptions.httpVersion;
            }
            return browserObject;
        });

        const possibleAttributeValues = {};

        // Find known browsers compatible with the input
        const browserHttpOptions = [];
        for (const browser of headerOptions.browsers) {
            for (const browserOption of uniqueBrowsers) {
                if (browser.name === browserOption.name) {
                    if ((!browser.minVersion || browserVersionIsLesserOrEquals([browser.minVersion], browserOption.version))
                        && (!browser.maxVersion || browserVersionIsLesserOrEquals(browserOption.version, [browser.maxVersion]))
                        && browser.httpVersion === browserOption.httpVersion) {
                        browserHttpOptions.push(browserOption.completeString);
                    }
                }
            }
        }

        possibleAttributeValues[BROWSER_HTTP_NODE_NAME] = browserHttpOptions;

        possibleAttributeValues[OPERATING_SYSTEM_NODE_NAME] = headerOptions.operatingSystems;

        if (headerOptions.devices) {
            possibleAttributeValues[DEVICE_NODE_NAME] = headerOptions.devices;
        }

        // Generate a sample of input attributes consistent with the data used to create the definition files if possible.
        const inputSample = this.inputGeneratorNetwork.generateConsistentSampleWhenPossible(possibleAttributeValues);

        if (!inputSample) {
            throw new Error('No headers based on this input can be generated. Please relax or change some of the requirements you specified.');
        }

        // Generate the actual headers
        let generatedSample = this.headerGeneratorNetwork.generateSample(inputSample);

        // Manually fill the accept-language header with random ordering of the locales from input
        const generatedHttpAndBrowser = prepareHttpBrowserObject(generatedSample[BROWSER_HTTP_NODE_NAME]);
        let secFetchAttributeNames = http2SecFetchAttributes;
        let acceptLanguageFieldName = 'accept-language';
        if (generatedHttpAndBrowser.httpVersion !== '2') {
            acceptLanguageFieldName = 'Accept-Language';
            secFetchAttributeNames = http1SecFetchAttributes;
        }

        let highLevelLocales = [];
        for (const locale of headerOptions.locales) {
            if (!locale.includes('-')) {
                highLevelLocales.push();
            }
        }

        for (const locale of headerOptions.locales) {
            if (!highLevelLocales.includes(locale)) {
                let highLevelEquivalentPresent = false;
                for (const highLevelLocale of highLevelLocales) {
                    if (locale.includes(highLevelLocale)) {
                        highLevelEquivalentPresent = true;
                        break;
                    }
                }
                if (!highLevelEquivalentPresent) highLevelLocales.push(locale);
            }
        }

        highLevelLocales = shuffleArray(highLevelLocales);
        headerOptions.locales = shuffleArray(headerOptions.locales);
        const localesInAddingOrder = [];
        for (const highLevelLocale of highLevelLocales) {
            for (const locale of headerOptions.locales) {
                if (locale.includes(highLevelLocale) && !highLevelLocales.includes(locale)) {
                    localesInAddingOrder.push(locale);
                }
            }
            localesInAddingOrder.push(highLevelLocale);
        }

        let acceptLanguageFieldValue = localesInAddingOrder[0];
        for (let x = 1; x < localesInAddingOrder.length; x++) {
            acceptLanguageFieldValue += `,${localesInAddingOrder[x]};${1 - x * 0.1}`;
        }

        generatedSample[acceptLanguageFieldName] = acceptLanguageFieldValue;

        // Add fixed headers if needed
        if (generatedHttpAndBrowser.name === 'chrome') {
            if (generatedHttpAndBrowser.version[0] >= 76) {
                generatedSample[secFetchAttributeNames.site] = 'same-site';
                generatedSample[secFetchAttributeNames.mode] = 'navigate';
                generatedSample[secFetchAttributeNames.user] = '?1';
                if (generatedHttpAndBrowser.version[0] >= 80) {
                    generatedSample[secFetchAttributeNames.dest] = 'document';
                }
            }
        }

        for (const attribute of Object.keys(generatedSample)) {
            if (attribute.startsWith('*') || generatedSample[attribute] === MISSING_VALUE_DATASET_TOKEN) delete generatedSample[attribute];
        }

        generatedSample = { ...generatedSample, ...requestDependentHeaders };

        // Order the headers in an order depending on the browser
        const orderedSample = {};
        for (const attribute of headersOrder[generatedHttpAndBrowser.name]) {
            if (attribute in generatedSample) {
                orderedSample[attribute] = generatedSample[attribute];
            }
        }

        return orderedSample;
    }
}

module.exports = HeaderGenerator;
