"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatusCodeForMediaRetry = exports.decryptMediaRetryData = exports.decodeMediaRetryNode = exports.encryptMediaRetryRequest = exports.getWAUploadToServer = exports.downloadEncryptedContent = exports.downloadContentFromMessage = exports.getUrlFromDirectPath = exports.encryptedStream = exports.prepareStream = exports.getHttpStream = exports.getStream = exports.toBuffer = exports.toReadable = exports.mediaMessageSHA256B64 = exports.generateProfilePicture = exports.encodeBase64EncodedStringForUpload = exports.extractImageThumb = exports.hkdfInfoKey = void 0;
exports.getMediaKeys = getMediaKeys;
exports.getAudioDuration = getAudioDuration;
exports.getAudioWaveform = getAudioWaveform;
exports.generateThumbnail = generateThumbnail;
exports.extensionForMediaMessage = extensionForMediaMessage;
const boom_1 = require("@hapi/boom");
const child_process_1 = require("child_process");
const Crypto = __importStar(require("crypto"));
const events_1 = require("events");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const stream_1 = require("stream");
const WAProto_1 = require("../../WAProto");
const Defaults_1 = require("../Defaults");
const WABinary_1 = require("../WABinary");
const crypto_1 = require("./crypto");
const generics_1 = require("./generics");
const getTmpFilesDirectory = () => (0, os_1.tmpdir)();
const getImageProcessingLibrary = () => __awaiter(void 0, void 0, void 0, function* () {
    const [_jimp, sharp] = yield Promise.all([
        (() => __awaiter(void 0, void 0, void 0, function* () {
            const jimp = yield (Promise.resolve().then(() => __importStar(require('jimp'))).catch(() => { }));
            return jimp;
        }))(),
        (() => __awaiter(void 0, void 0, void 0, function* () {
            const sharp = yield (Promise.resolve().then(() => __importStar(require('sharp'))).catch(() => { }));
            return sharp;
        }))()
    ]);
    if (sharp) {
        return { sharp };
    }
    const jimp = (_jimp === null || _jimp === void 0 ? void 0 : _jimp.default) || _jimp;
    if (jimp) {
        return { jimp };
    }
    throw new boom_1.Boom('No image processing library available');
});
const hkdfInfoKey = (type) => {
    const hkdfInfo = Defaults_1.MEDIA_HKDF_KEY_MAPPING[type];
    return `WhatsApp ${hkdfInfo} Keys`;
};
exports.hkdfInfoKey = hkdfInfoKey;
/** generates all the keys required to encrypt/decrypt & sign a media message */
function getMediaKeys(buffer, mediaType) {
    if (!buffer) {
        throw new boom_1.Boom('Cannot derive from empty media key');
    }
    if (typeof buffer === 'string') {
        buffer = Buffer.from(buffer.replace('data:;base64,', ''), 'base64');
    }
    // expand using HKDF to 112 bytes, also pass in the relevant app info
    const expandedMediaKey = (0, crypto_1.hkdf)(buffer, 112, { info: (0, exports.hkdfInfoKey)(mediaType) });
    return {
        iv: expandedMediaKey.slice(0, 16),
        cipherKey: expandedMediaKey.slice(16, 48),
        macKey: expandedMediaKey.slice(48, 80),
    };
}
/** Extracts video thumb using FFMPEG */
const extractVideoThumb = (path, destPath, time, size) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve, reject) => {
        const cmd = `ffmpeg -ss ${time} -i ${path} -y -vf scale=${size.width}:-1 -vframes 1 -f image2 ${destPath}`;
        (0, child_process_1.exec)(cmd, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
});
const extractImageThumb = (bufferOrFilePath_1, ...args_1) => __awaiter(void 0, [bufferOrFilePath_1, ...args_1], void 0, function* (bufferOrFilePath, width = 32) {
    var _a, _b;
    if (bufferOrFilePath instanceof stream_1.Readable) {
        bufferOrFilePath = yield (0, exports.toBuffer)(bufferOrFilePath);
    }
    const lib = yield getImageProcessingLibrary();
    if ('sharp' in lib && typeof ((_a = lib.sharp) === null || _a === void 0 ? void 0 : _a.default) === 'function') {
        const img = lib.sharp.default(bufferOrFilePath);
        const dimensions = yield img.metadata();
        const buffer = yield img
            .resize(width)
            .jpeg({ quality: 50 })
            .toBuffer();
        return {
            buffer,
            original: {
                width: dimensions.width,
                height: dimensions.height,
            },
        };
    }
    else if ('jimp' in lib && typeof ((_b = lib.jimp) === null || _b === void 0 ? void 0 : _b.read) === 'function') {
        const { read, MIME_JPEG, RESIZE_BILINEAR, AUTO } = lib.jimp;
        const jimp = yield read(bufferOrFilePath);
        const dimensions = {
            width: jimp.getWidth(),
            height: jimp.getHeight()
        };
        const buffer = yield jimp
            .quality(50)
            .resize(width, AUTO, RESIZE_BILINEAR)
            .getBufferAsync(MIME_JPEG);
        return {
            buffer,
            original: dimensions
        };
    }
    else {
        throw new boom_1.Boom('No image processing library available');
    }
});
exports.extractImageThumb = extractImageThumb;
const encodeBase64EncodedStringForUpload = (b64) => (encodeURIComponent(b64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/\=+$/, '')));
exports.encodeBase64EncodedStringForUpload = encodeBase64EncodedStringForUpload;
const generateProfilePicture = (mediaUpload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    let bufferOrFilePath;
    if (Buffer.isBuffer(mediaUpload)) {
        bufferOrFilePath = mediaUpload;
    }
    else if ('url' in mediaUpload) {
        bufferOrFilePath = mediaUpload.url.toString();
    }
    else {
        bufferOrFilePath = yield (0, exports.toBuffer)(mediaUpload.stream);
    }
    const lib = yield getImageProcessingLibrary();
    let img;
    if ('sharp' in lib && typeof ((_a = lib.sharp) === null || _a === void 0 ? void 0 : _a.default) === 'function') {
        img = lib.sharp.default(bufferOrFilePath)
            .resize(640, 640)
            .jpeg({
            quality: 50,
        })
            .toBuffer();
    }
    else if ('jimp' in lib && typeof ((_b = lib.jimp) === null || _b === void 0 ? void 0 : _b.read) === 'function') {
        const { read, MIME_JPEG, RESIZE_BILINEAR } = lib.jimp;
        const jimp = yield read(bufferOrFilePath);
        const min = Math.min(jimp.getWidth(), jimp.getHeight());
        const cropped = jimp.crop(0, 0, min, min);
        img = cropped
            .quality(50)
            .resize(640, 640, RESIZE_BILINEAR)
            .getBufferAsync(MIME_JPEG);
    }
    else {
        throw new boom_1.Boom('No image processing library available');
    }
    return {
        img: yield img,
    };
});
exports.generateProfilePicture = generateProfilePicture;
/** gets the SHA256 of the given media message */
const mediaMessageSHA256B64 = (message) => {
    const media = Object.values(message)[0];
    return (media === null || media === void 0 ? void 0 : media.fileSha256) && Buffer.from(media.fileSha256).toString('base64');
};
exports.mediaMessageSHA256B64 = mediaMessageSHA256B64;
function getAudioDuration(buffer) {
    return __awaiter(this, void 0, void 0, function* () {
        const musicMetadata = yield Promise.resolve().then(() => __importStar(require('music-metadata')));
        let metadata;
        if (Buffer.isBuffer(buffer)) {
            metadata = yield musicMetadata.parseBuffer(buffer, undefined, { duration: true });
        }
        else if (typeof buffer === 'string') {
            const rStream = (0, fs_1.createReadStream)(buffer);
            try {
                metadata = yield musicMetadata.parseStream(rStream, undefined, { duration: true });
            }
            finally {
                rStream.destroy();
            }
        }
        else {
            metadata = yield musicMetadata.parseStream(buffer, undefined, { duration: true });
        }
        return metadata.format.duration;
    });
}
/**
  referenced from and modifying https://github.com/wppconnect-team/wa-js/blob/main/src/chat/functions/prepareAudioWaveform.ts
 */
function getAudioWaveform(buffer, logger) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const audioDecode = (buffer) => Promise.resolve().then(() => __importStar(require('audio-decode'))).then(({ default: audioDecode }) => audioDecode(buffer));
            let audioData;
            if (Buffer.isBuffer(buffer)) {
                audioData = buffer;
            }
            else if (typeof buffer === 'string') {
                const rStream = (0, fs_1.createReadStream)(buffer);
                audioData = yield (0, exports.toBuffer)(rStream);
            }
            else {
                audioData = yield (0, exports.toBuffer)(buffer);
            }
            const audioBuffer = yield audioDecode(audioData);
            const rawData = audioBuffer.getChannelData(0); // We only need to work with one channel of data
            const samples = 64; // Number of samples we want to have in our final data set
            const blockSize = Math.floor(rawData.length / samples); // the number of samples in each subdivision
            const filteredData = [];
            for (let i = 0; i < samples; i++) {
                const blockStart = blockSize * i; // the location of the first sample in the block
                let sum = 0;
                for (let j = 0; j < blockSize; j++) {
                    sum = sum + Math.abs(rawData[blockStart + j]); // find the sum of all the samples in the block
                }
                filteredData.push(sum / blockSize); // divide the sum by the block size to get the average
            }
            // This guarantees that the largest data point will be set to 1, and the rest of the data will scale proportionally.
            const multiplier = Math.pow(Math.max(...filteredData), -1);
            const normalizedData = filteredData.map((n) => n * multiplier);
            // Generate waveform like WhatsApp
            const waveform = new Uint8Array(normalizedData.map((n) => Math.floor(100 * n)));
            return waveform;
        }
        catch (e) {
            logger === null || logger === void 0 ? void 0 : logger.debug('Failed to generate waveform: ' + e);
        }
    });
}
const toReadable = (buffer) => {
    const readable = new stream_1.Readable({ read: () => { } });
    readable.push(buffer);
    readable.push(null);
    return readable;
};
exports.toReadable = toReadable;
const toBuffer = (stream) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, stream_2, stream_2_1;
    var _b, e_1, _c, _d;
    const chunks = [];
    try {
        for (_a = true, stream_2 = __asyncValues(stream); stream_2_1 = yield stream_2.next(), _b = stream_2_1.done, !_b; _a = true) {
            _d = stream_2_1.value;
            _a = false;
            const chunk = _d;
            chunks.push(chunk);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_a && !_b && (_c = stream_2.return)) yield _c.call(stream_2);
        }
        finally { if (e_1) throw e_1.error; }
    }
    stream.destroy();
    return Buffer.concat(chunks);
});
exports.toBuffer = toBuffer;
const getStream = (item, opts) => __awaiter(void 0, void 0, void 0, function* () {
    if (Buffer.isBuffer(item)) {
        return { stream: (0, exports.toReadable)(item), type: 'buffer' };
    }
    if ('stream' in item) {
        return { stream: item.stream, type: 'readable' };
    }
    if (item.url.toString().startsWith('http://') || item.url.toString().startsWith('https://')) {
        return { stream: yield (0, exports.getHttpStream)(item.url, opts), type: 'remote' };
    }
    return { stream: (0, fs_1.createReadStream)(item.url), type: 'file' };
});
exports.getStream = getStream;
/** generates a thumbnail for a given media, if required */
function generateThumbnail(file, mediaType, options) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        let thumbnail;
        let originalImageDimensions;
        if (mediaType === 'image') {
            const { buffer, original } = yield (0, exports.extractImageThumb)(file);
            thumbnail = buffer.toString('base64');
            if (original.width && original.height) {
                originalImageDimensions = {
                    width: original.width,
                    height: original.height,
                };
            }
        }
        else if (mediaType === 'video') {
            const imgFilename = (0, path_1.join)(getTmpFilesDirectory(), (0, generics_1.generateMessageID)() + '.jpg');
            try {
                yield extractVideoThumb(file, imgFilename, '00:00:00', { width: 32, height: 32 });
                const buff = yield fs_1.promises.readFile(imgFilename);
                thumbnail = buff.toString('base64');
                yield fs_1.promises.unlink(imgFilename);
            }
            catch (err) {
                (_a = options.logger) === null || _a === void 0 ? void 0 : _a.debug('could not generate video thumb: ' + err);
            }
        }
        return {
            thumbnail,
            originalImageDimensions
        };
    });
}
const getHttpStream = (url_1, ...args_1) => __awaiter(void 0, [url_1, ...args_1], void 0, function* (url, options = {}) {
    const { default: axios } = yield Promise.resolve().then(() => __importStar(require('axios')));
    const fetched = yield axios.get(url.toString(), Object.assign(Object.assign({}, options), { responseType: 'stream' }));
    return fetched.data;
});
exports.getHttpStream = getHttpStream;
const prepareStream = (media_1, mediaType_1, ...args_1) => __awaiter(void 0, [media_1, mediaType_1, ...args_1], void 0, function* (media, mediaType, { logger, saveOriginalFileIfRequired, opts } = {}) {
    const { stream, type } = yield (0, exports.getStream)(media, opts);
    logger === null || logger === void 0 ? void 0 : logger.debug('fetched media stream');
    let bodyPath;
    let didSaveToTmpPath = false;
    try {
        const buffer = yield (0, exports.toBuffer)(stream);
        if (type === 'file') {
            bodyPath = media.url;
        }
        else if (saveOriginalFileIfRequired) {
            bodyPath = (0, path_1.join)(getTmpFilesDirectory(), mediaType + (0, generics_1.generateMessageID)());
            (0, fs_1.writeFileSync)(bodyPath, buffer);
            didSaveToTmpPath = true;
        }
        const fileLength = buffer.length;
        const fileSha256 = Crypto.createHash('sha256').update(buffer).digest();
        stream === null || stream === void 0 ? void 0 : stream.destroy();
        logger === null || logger === void 0 ? void 0 : logger.debug('prepare stream data successfully');
        return {
            mediaKey: undefined,
            encWriteStream: buffer,
            fileLength,
            fileSha256,
            fileEncSha256: undefined,
            bodyPath,
            didSaveToTmpPath
        };
    }
    catch (error) {
        // destroy all streams with error
        stream.destroy();
        if (didSaveToTmpPath) {
            try {
                yield fs_1.promises.unlink(bodyPath);
            }
            catch (err) {
                logger === null || logger === void 0 ? void 0 : logger.error({ err }, 'failed to save to tmp path');
            }
        }
        throw error;
    }
});
exports.prepareStream = prepareStream;
const encryptedStream = (media_1, mediaType_1, ...args_1) => __awaiter(void 0, [media_1, mediaType_1, ...args_1], void 0, function* (media, mediaType, { logger, saveOriginalFileIfRequired, opts } = {}) {
    var _a, e_2, _b, _c;
    const { stream, type } = yield (0, exports.getStream)(media, opts);
    logger === null || logger === void 0 ? void 0 : logger.debug('fetched media stream');
    const mediaKey = Crypto.randomBytes(32);
    const { cipherKey, iv, macKey } = getMediaKeys(mediaKey, mediaType);
    const encWriteStream = new stream_1.Readable({ read: () => { } });
    let bodyPath;
    let writeStream;
    let didSaveToTmpPath = false;
    if (type === 'file') {
        bodyPath = media.url;
    }
    else if (saveOriginalFileIfRequired) {
        bodyPath = (0, path_1.join)(getTmpFilesDirectory(), mediaType + (0, generics_1.generateMessageID)());
        writeStream = (0, fs_1.createWriteStream)(bodyPath);
        didSaveToTmpPath = true;
    }
    let fileLength = 0;
    const aes = Crypto.createCipheriv('aes-256-cbc', cipherKey, iv);
    let hmac = Crypto.createHmac('sha256', macKey).update(iv);
    let sha256Plain = Crypto.createHash('sha256');
    let sha256Enc = Crypto.createHash('sha256');
    try {
        try {
            for (var _d = true, stream_3 = __asyncValues(stream), stream_3_1; stream_3_1 = yield stream_3.next(), _a = stream_3_1.done, !_a; _d = true) {
                _c = stream_3_1.value;
                _d = false;
                const data = _c;
                fileLength += data.length;
                if (type === 'remote'
                    && (opts === null || opts === void 0 ? void 0 : opts.maxContentLength)
                    && fileLength + data.length > opts.maxContentLength) {
                    throw new boom_1.Boom(`content length exceeded when encrypting "${type}"`, {
                        data: { media, type }
                    });
                }
                sha256Plain = sha256Plain.update(data);
                if (writeStream) {
                    if (!writeStream.write(data)) {
                        yield (0, events_1.once)(writeStream, 'drain');
                    }
                }
                onChunk(aes.update(data));
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = stream_3.return)) yield _b.call(stream_3);
            }
            finally { if (e_2) throw e_2.error; }
        }
        onChunk(aes.final());
        const mac = hmac.digest().slice(0, 10);
        sha256Enc = sha256Enc.update(mac);
        const fileSha256 = sha256Plain.digest();
        const fileEncSha256 = sha256Enc.digest();
        encWriteStream.push(mac);
        encWriteStream.push(null);
        writeStream === null || writeStream === void 0 ? void 0 : writeStream.end();
        stream.destroy();
        logger === null || logger === void 0 ? void 0 : logger.debug('encrypted data successfully');
        return {
            mediaKey,
            encWriteStream,
            bodyPath,
            mac,
            fileEncSha256,
            fileSha256,
            fileLength,
            didSaveToTmpPath
        };
    }
    catch (error) {
        // destroy all streams with error
        encWriteStream.destroy();
        writeStream === null || writeStream === void 0 ? void 0 : writeStream.destroy();
        aes.destroy();
        hmac.destroy();
        sha256Plain.destroy();
        sha256Enc.destroy();
        stream.destroy();
        if (didSaveToTmpPath) {
            try {
                yield fs_1.promises.unlink(bodyPath);
            }
            catch (err) {
                logger === null || logger === void 0 ? void 0 : logger.error({ err }, 'failed to save to tmp path');
            }
        }
        throw error;
    }
    function onChunk(buff) {
        sha256Enc = sha256Enc.update(buff);
        hmac = hmac.update(buff);
        encWriteStream.push(buff);
    }
});
exports.encryptedStream = encryptedStream;
const DEF_HOST = 'mmg.whatsapp.net';
const AES_CHUNK_SIZE = 16;
const toSmallestChunkSize = (num) => {
    return Math.floor(num / AES_CHUNK_SIZE) * AES_CHUNK_SIZE;
};
const getUrlFromDirectPath = (directPath) => `https://${DEF_HOST}${directPath}`;
exports.getUrlFromDirectPath = getUrlFromDirectPath;
const downloadContentFromMessage = ({ mediaKey, directPath, url }, type, opts = {}) => {
    const downloadUrl = url || (0, exports.getUrlFromDirectPath)(directPath);
    const keys = getMediaKeys(mediaKey, type);
    return (0, exports.downloadEncryptedContent)(downloadUrl, keys, opts);
};
exports.downloadContentFromMessage = downloadContentFromMessage;
/**
 * Decrypts and downloads an AES256-CBC encrypted file given the keys.
 * Assumes the SHA256 of the plaintext is appended to the end of the ciphertext
 * */
const downloadEncryptedContent = (downloadUrl_1, _a, ...args_1) => __awaiter(void 0, [downloadUrl_1, _a, ...args_1], void 0, function* (downloadUrl, { cipherKey, iv }, { startByte, endByte, options } = {}) {
    let bytesFetched = 0;
    let startChunk = 0;
    let firstBlockIsIV = false;
    // if a start byte is specified -- then we need to fetch the previous chunk as that will form the IV
    if (startByte) {
        const chunk = toSmallestChunkSize(startByte || 0);
        if (chunk) {
            startChunk = chunk - AES_CHUNK_SIZE;
            bytesFetched = chunk;
            firstBlockIsIV = true;
        }
    }
    const endChunk = endByte ? toSmallestChunkSize(endByte || 0) + AES_CHUNK_SIZE : undefined;
    const headers = Object.assign(Object.assign({}, (options === null || options === void 0 ? void 0 : options.headers) || {}), { Origin: Defaults_1.DEFAULT_ORIGIN });
    if (startChunk || endChunk) {
        headers.Range = `bytes=${startChunk}-`;
        if (endChunk) {
            headers.Range += endChunk;
        }
    }
    // download the message
    const fetched = yield (0, exports.getHttpStream)(downloadUrl, Object.assign(Object.assign({}, options || {}), { headers, maxBodyLength: Infinity, maxContentLength: Infinity }));
    let remainingBytes = Buffer.from([]);
    let aes;
    const pushBytes = (bytes, push) => {
        if (startByte || endByte) {
            const start = bytesFetched >= startByte ? undefined : Math.max(startByte - bytesFetched, 0);
            const end = bytesFetched + bytes.length < endByte ? undefined : Math.max(endByte - bytesFetched, 0);
            push(bytes.slice(start, end));
            bytesFetched += bytes.length;
        }
        else {
            push(bytes);
        }
    };
    const output = new stream_1.Transform({
        transform(chunk, _, callback) {
            let data = Buffer.concat([remainingBytes, chunk]);
            const decryptLength = toSmallestChunkSize(data.length);
            remainingBytes = data.slice(decryptLength);
            data = data.slice(0, decryptLength);
            if (!aes) {
                let ivValue = iv;
                if (firstBlockIsIV) {
                    ivValue = data.slice(0, AES_CHUNK_SIZE);
                    data = data.slice(AES_CHUNK_SIZE);
                }
                aes = Crypto.createDecipheriv('aes-256-cbc', cipherKey, ivValue);
                // if an end byte that is not EOF is specified
                // stop auto padding (PKCS7) -- otherwise throws an error for decryption
                if (endByte) {
                    aes.setAutoPadding(false);
                }
            }
            try {
                pushBytes(aes.update(data), b => this.push(b));
                callback();
            }
            catch (error) {
                callback(error);
            }
        },
        final(callback) {
            try {
                pushBytes(aes.final(), b => this.push(b));
                callback();
            }
            catch (error) {
                callback(error);
            }
        },
    });
    return fetched.pipe(output, { end: true });
});
exports.downloadEncryptedContent = downloadEncryptedContent;
function extensionForMediaMessage(message) {
    const getExtension = (mimetype) => mimetype.split(';')[0].split('/')[1];
    const type = Object.keys(message)[0];
    let extension;
    if (type === 'locationMessage' ||
        type === 'liveLocationMessage' ||
        type === 'productMessage') {
        extension = '.jpeg';
    }
    else {
        const messageContent = message[type];
        extension = getExtension(messageContent.mimetype);
    }
    return extension;
}
const getWAUploadToServer = ({ customUploadHosts, fetchAgent, logger, options }, refreshMediaConn) => {
    return (stream_4, _a) => __awaiter(void 0, [stream_4, _a], void 0, function* (stream, { mediaType, fileEncSha256B64, newsletter, timeoutMs }) {
        var _b, stream_5, stream_5_1;
        var _c, e_3, _d, _e;
        var _f, _g;
        const { default: axios } = yield Promise.resolve().then(() => __importStar(require('axios')));
        // send a query JSON to obtain the url & auth token to upload our media
        let uploadInfo = yield refreshMediaConn(false);
        let urls;
        const hosts = [...customUploadHosts, ...uploadInfo.hosts];
        const chunks = [];
        if (!Buffer.isBuffer(stream)) {
            try {
                for (_b = true, stream_5 = __asyncValues(stream); stream_5_1 = yield stream_5.next(), _c = stream_5_1.done, !_c; _b = true) {
                    _e = stream_5_1.value;
                    _b = false;
                    const chunk = _e;
                    chunks.push(chunk);
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (!_b && !_c && (_d = stream_5.return)) yield _d.call(stream_5);
                }
                finally { if (e_3) throw e_3.error; }
            }
        }
        const reqBody = Buffer.isBuffer(stream) ? stream : Buffer.concat(chunks);
        fileEncSha256B64 = (0, exports.encodeBase64EncodedStringForUpload)(fileEncSha256B64);
        let media = Defaults_1.MEDIA_PATH_MAP[mediaType];
        if (newsletter) {
            media = media === null || media === void 0 ? void 0 : media.replace('/mms/', '/newsletter/newsletter-');
        }
        for (const { hostname, maxContentLengthBytes } of hosts) {
            logger.debug(`uploading to "${hostname}"`);
            const auth = encodeURIComponent(uploadInfo.auth); // the auth token
            const url = `https://${hostname}${media}/${fileEncSha256B64}?auth=${auth}&token=${fileEncSha256B64}`;
            let result;
            try {
                if (maxContentLengthBytes && reqBody.length > maxContentLengthBytes) {
                    throw new boom_1.Boom(`Body too large for "${hostname}"`, { statusCode: 413 });
                }
                const body = yield axios.post(url, reqBody, Object.assign(Object.assign({}, options), { headers: Object.assign(Object.assign({}, options.headers || {}), { 'Content-Type': 'application/octet-stream', 'Origin': Defaults_1.DEFAULT_ORIGIN }), httpsAgent: fetchAgent, timeout: timeoutMs, responseType: 'json', maxBodyLength: Infinity, maxContentLength: Infinity }));
                result = body.data;
                if ((result === null || result === void 0 ? void 0 : result.url) || (result === null || result === void 0 ? void 0 : result.directPath)) {
                    urls = {
                        mediaUrl: result.url,
                        directPath: result.direct_path,
                        handle: result.handle
                    };
                    break;
                }
                else {
                    uploadInfo = yield refreshMediaConn(true);
                    throw new Error(`upload failed, reason: ${JSON.stringify(result)}`);
                }
            }
            catch (error) {
                if (axios.isAxiosError(error)) {
                    result = (_f = error.response) === null || _f === void 0 ? void 0 : _f.data;
                }
                const isLast = hostname === ((_g = hosts[uploadInfo.hosts.length - 1]) === null || _g === void 0 ? void 0 : _g.hostname);
                logger.warn({ trace: error.stack, uploadResult: result }, `Error in uploading to ${hostname} ${isLast ? '' : ', retrying...'}`);
            }
        }
        if (!urls) {
            throw new boom_1.Boom('Media upload failed on all hosts', { statusCode: 500 });
        }
        return urls;
    });
};
exports.getWAUploadToServer = getWAUploadToServer;
const getMediaRetryKey = (mediaKey) => {
    return (0, crypto_1.hkdf)(mediaKey, 32, { info: 'WhatsApp Media Retry Notification' });
};
/**
 * Generate a binary node that will request the phone to re-upload the media & return the newly uploaded URL
 */
const encryptMediaRetryRequest = (key, mediaKey, meId) => {
    const recp = { stanzaId: key.id };
    const recpBuffer = WAProto_1.proto.ServerErrorReceipt.encode(recp).finish();
    const iv = Crypto.randomBytes(12);
    const retryKey = getMediaRetryKey(mediaKey);
    const ciphertext = (0, crypto_1.aesEncryptGCM)(recpBuffer, retryKey, iv, Buffer.from(key.id));
    const req = {
        tag: 'receipt',
        attrs: {
            id: key.id,
            to: (0, WABinary_1.jidNormalizedUser)(meId),
            type: 'server-error'
        },
        content: [
            // this encrypt node is actually pretty useless
            // the media is returned even without this node
            // keeping it here to maintain parity with WA Web
            {
                tag: 'encrypt',
                attrs: {},
                content: [
                    { tag: 'enc_p', attrs: {}, content: ciphertext },
                    { tag: 'enc_iv', attrs: {}, content: iv }
                ]
            },
            {
                tag: 'rmr',
                attrs: {
                    jid: key.remoteJid,
                    'from_me': (!!key.fromMe).toString(),
                    // @ts-ignore
                    participant: key.participant || undefined
                }
            }
        ]
    };
    return req;
};
exports.encryptMediaRetryRequest = encryptMediaRetryRequest;
const decodeMediaRetryNode = (node) => {
    const rmrNode = (0, WABinary_1.getBinaryNodeChild)(node, 'rmr');
    const event = {
        key: {
            id: node.attrs.id,
            remoteJid: rmrNode.attrs.jid,
            fromMe: rmrNode.attrs.from_me === 'true',
            participant: rmrNode.attrs.participant
        }
    };
    const errorNode = (0, WABinary_1.getBinaryNodeChild)(node, 'error');
    if (errorNode) {
        const errorCode = +errorNode.attrs.code;
        event.error = new boom_1.Boom(`Failed to re-upload media (${errorCode})`, { data: errorNode.attrs, statusCode: (0, exports.getStatusCodeForMediaRetry)(errorCode) });
    }
    else {
        const encryptedInfoNode = (0, WABinary_1.getBinaryNodeChild)(node, 'encrypt');
        const ciphertext = (0, WABinary_1.getBinaryNodeChildBuffer)(encryptedInfoNode, 'enc_p');
        const iv = (0, WABinary_1.getBinaryNodeChildBuffer)(encryptedInfoNode, 'enc_iv');
        if (ciphertext && iv) {
            event.media = { ciphertext, iv };
        }
        else {
            event.error = new boom_1.Boom('Failed to re-upload media (missing ciphertext)', { statusCode: 404 });
        }
    }
    return event;
};
exports.decodeMediaRetryNode = decodeMediaRetryNode;
const decryptMediaRetryData = ({ ciphertext, iv }, mediaKey, msgId) => {
    const retryKey = getMediaRetryKey(mediaKey);
    const plaintext = (0, crypto_1.aesDecryptGCM)(ciphertext, retryKey, iv, Buffer.from(msgId));
    return WAProto_1.proto.MediaRetryNotification.decode(plaintext);
};
exports.decryptMediaRetryData = decryptMediaRetryData;
const getStatusCodeForMediaRetry = (code) => MEDIA_RETRY_STATUS_MAP[code];
exports.getStatusCodeForMediaRetry = getStatusCodeForMediaRetry;
const MEDIA_RETRY_STATUS_MAP = {
    [WAProto_1.proto.MediaRetryNotification.ResultType.SUCCESS]: 200,
    [WAProto_1.proto.MediaRetryNotification.ResultType.DECRYPTION_ERROR]: 412,
    [WAProto_1.proto.MediaRetryNotification.ResultType.NOT_FOUND]: 404,
    [WAProto_1.proto.MediaRetryNotification.ResultType.GENERAL_ERROR]: 418,
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function __importStar(arg0) {
    throw new Error('Function not implemented.');
}