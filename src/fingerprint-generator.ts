import { HeaderGenerator, HeaderGeneratorOptions } from 'header-generator';

// @ts-expect-error No ts definition
import { BayesianNetwork } from 'generative-bayesian-network';

import fingerprintNetworkDefinition from './data_files/fingerprint-network-definition.json';
import { MISSING_VALUE_DATASET_TOKEN, STRINGIFIED_PREFIX } from './constants';

export type ScreenFingerprint = {
    availHeight: number,
    availWidth: number,
    pixelDepth: number,
    height: number,
    width: number,
}

export type NavigatorFingerprint = {
    cookieEnabled: boolean,
    doNotTrack: string,
    language: string,
    languages: string[],
    platform: string,
    deviceMemory?: number, // Firefox does not have deviceMemory available
    hardwareConcurrency: number,
    productSub: string,
    vendor: string,
    maxTouchPoints?: number;
}

type WebGl = {
    vendor: string,
    renderer: string,
}

export type Fingerprint = {
    screen: ScreenFingerprint,
    navigator: NavigatorFingerprint,
    webGl: WebGl,
    userAgent: string,
    videoCodecs: Record<string, string>,
    audioCodecs: Record<string, string>,
    battery?: boolean,
}

type GetFingerprintReturnType = {
    headers: Record<string, string>,
    fingerprint: Fingerprint,
}
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
 * @param {string} browserListQuery - Browser generation query based on the real world data.
 *  For more info see the [query docs](https://github.com/browserslist/browserslist#full-list).
 *  If `browserListQuery` is passed the `browsers` array is ignored.
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
 * Fingerprint generator - randomly generates realistic browser fingerprints
 */
export class FingerprintGenerator extends HeaderGenerator {
    fingerprintGeneratorNetwork: BayesianNetwork;

    /**
     * @param {HeaderGeneratorOptions} options - default header generation options used unless overridden
     */
    constructor(options: Partial<HeaderGeneratorOptions> = {}) {
        super(options);
        this.fingerprintGeneratorNetwork = new BayesianNetwork(fingerprintNetworkDefinition);
    }

    /**
     * Generates a fingerprint and a matching set of ordered headers using a combination of the default options specified in the constructor
     * and their possible overrides provided here.
     * @param {HeaderGeneratorOptions} options - specifies options that should be overridden for this one call
     * @param {Object} requestDependentHeaders - specifies known values of headers dependent on the particular request
     */
    getFingerprint(options: Partial<HeaderGeneratorOptions> = {}, requestDependentHeaders: Record<string, string> = {}): GetFingerprintReturnType {
        // Generate headers consistent with the inputs to get input-compatible user-agent and accept-language headers needed later
        const headers = super.getHeaders(options, requestDependentHeaders);
        const userAgent = 'User-Agent' in headers ? headers['User-Agent'] : headers['user-agent'];

        // Generate fingerprint consistent with the generated user agent
        const fingerprint: Record<string, any> = this.fingerprintGeneratorNetwork.generateSample({
            userAgent,
        });

        /* Delete any missing attributes and unpack any object/array-like attributes
         * that have been packed together to make the underlying network simpler
         */
        for (const attribute of Object.keys(fingerprint)) {
            if (fingerprint[attribute] === MISSING_VALUE_DATASET_TOKEN) {
                delete fingerprint[attribute];
            } else if (fingerprint[attribute].startsWith(STRINGIFIED_PREFIX)) {
                fingerprint[attribute] = JSON.parse(fingerprint[attribute].slice(STRINGIFIED_PREFIX.length));
            }
        }

        // Unpack plugin and screen characteristics attributes that are generated packed together to make sure they are consistent with each other
        if ('pluginCharacteristics' in fingerprint) {
            for (const attribute of Object.keys(fingerprint.pluginCharacteristics)) {
                fingerprint[attribute] = fingerprint.pluginCharacteristics[attribute];
            }
            delete fingerprint.pluginCharacteristics;
        }
        if ('screenCharacteristics' in fingerprint) {
            for (const attribute of Object.keys(fingerprint.screenCharacteristics)) {
                fingerprint[attribute] = fingerprint.screenCharacteristics[attribute];
            }
            delete fingerprint.screenCharacteristics;
        }

        // Manually add the set of accepted languages required by the input
        const acceptLanguageHeaderValue = 'Accept-Language' in headers ? headers['Accept-Language'] : headers['accept-language'];
        const acceptedLanguages = [];
        for (const locale of acceptLanguageHeaderValue.split(',')) {
            acceptedLanguages.push(locale.split(';')[0]);
        }
        fingerprint.languages = acceptedLanguages;

        return {
            fingerprint: this._transformFingerprint(fingerprint),
            headers,
        };
    }

    /**
     * Transforms fingerprint to the final scheme, more suitable for fingerprint manipulation and injection.
     * This schema is used in the fingerprint-injector.
     * @private
     * @param {Object} fingerprint
     * @returns {Object} final fingerprint.
     */
    _transformFingerprint(fingerprint: Record<string, any>): Fingerprint {
        const {
            availableScreenResolution = [],
            colorDepth,
            screenResolution = [],
            userAgent,
            cookiesEnabled,
            languages,
            platform,
            mimeTypes,
            plugins,
            deviceMemory,
            hardwareConcurrency,
            productSub,
            vendor,
            touchSupport = {},
            videoCard,
            audioCodecs,
            videoCodecs,
            battery,
        } = fingerprint;

        const screen = {
            availHeight: availableScreenResolution[0],
            availWidth: availableScreenResolution[1],
            pixelDepth: colorDepth,
            height: screenResolution[0],
            width: screenResolution[1],
        };

        const parsedMemory = parseInt(deviceMemory, 10);
        const parsedTouchPoints = parseInt(touchSupport.maxTouchPoints, 10);

        const navigator = {
            cookieEnabled: cookiesEnabled,
            doNotTrack: '1',
            language: languages[0],
            languages,
            platform,
            deviceMemory: Number.isNaN(parsedMemory) ? undefined : parsedMemory, // Firefox does not have deviceMemory available
            hardwareConcurrency: parseInt(hardwareConcurrency, 10),
            productSub,
            vendor,
            maxTouchPoints: Number.isNaN(parsedTouchPoints) ? 0 : parsedTouchPoints,
        };

        const pluginsData = {
            mimeTypes,
            plugins,
        };
        const webGl = {
            vendor: videoCard[0],
            renderer: videoCard[1],
        };

        return {
            screen,
            navigator,
            webGl,
            audioCodecs,
            videoCodecs,
            pluginsData,
            userAgent,
            battery,
        } as Fingerprint;
    }
}
