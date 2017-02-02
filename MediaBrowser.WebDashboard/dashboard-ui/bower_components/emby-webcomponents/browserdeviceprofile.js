define(['browser'], function (browser) {
    'use strict';

    function canPlayH264() {
        var v = document.createElement('video');
        return !!(v.canPlayType && v.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"').replace(/no/, ''));
    }

    function canPlayH265() {

        if (browser.tizen) {
            return true;
        }

        return false;
    }

    var _supportsTextTracks;
    function supportsTextTracks() {

        if (_supportsTextTracks == null) {
            _supportsTextTracks = document.createElement('video').textTracks != null;
        }

        // For now, until ready
        return _supportsTextTracks;
    }

    var _canPlayHls;
    function canPlayHls(src) {

        if (_canPlayHls == null) {
            _canPlayHls = canPlayNativeHls() || canPlayHlsWithMSE();
        }
        return _canPlayHls;
    }

    function canPlayNativeHls() {
        var media = document.createElement('video');

        if (media.canPlayType('application/x-mpegURL').replace(/no/, '') ||
            media.canPlayType('application/vnd.apple.mpegURL').replace(/no/, '')) {
            return true;
        }

        return false;
    }

    function canPlayHlsWithMSE() {
        if (window.MediaSource != null) {
            // text tracks don’t work with this in firefox
            return true;
        }

        return false;
    }

    function canPlayAudioFormat(format) {

        var typeString;

        if (format === 'flac') {
            if (browser.tizen) {
                return true;
            }
            if (browser.edgeUwp) {
                return true;
            }
        }

        else if (format === 'wma') {
            if (browser.tizen) {
                return true;
            }
            if (browser.edgeUwp) {
                return true;
            }
        }

        else if (format === 'opus') {
            typeString = 'audio/ogg; codecs="opus"';

            if (document.createElement('audio').canPlayType(typeString).replace(/no/, '')) {
                return true;
            }

            return false;
        }

        if (format === 'webma') {
            typeString = 'audio/webm';
        } else {
            typeString = 'audio/' + format;
        }

        if (document.createElement('audio').canPlayType(typeString).replace(/no/, '')) {
            return true;
        }

        return false;
    }

    function testCanPlayMkv(videoTestElement) {

        if (videoTestElement.canPlayType('video/x-matroska') ||
            videoTestElement.canPlayType('video/mkv')) {
            return true;
        }

        var userAgent = navigator.userAgent.toLowerCase();

        // Unfortunately there's no real way to detect mkv support
        if (browser.chrome) {

            // Not supported on opera tv
            if (browser.operaTv) {
                return false;
            }

            // Filter out browsers based on chromium that don't support mkv
            if (userAgent.indexOf('vivaldi') !== -1 || userAgent.indexOf('opera') !== -1) {
                return false;
            }

            return true;
        }

        if (browser.tizen) {
            return true;
        }

        if (browser.edgeUwp) {

            return true;
        }

        return false;
    }

    function testCanPlayTs() {

        return browser.tizen || browser.web0s || browser.edgeUwp;
    }

    function getDirectPlayProfileForVideoContainer(container, videoAudioCodecs) {

        var supported = false;
        var profileContainer = container;
        var videoCodecs = [];

        switch (container) {

            case 'asf':
                supported = browser.tizen || browser.edgeUwp;
                videoAudioCodecs = [];
                break;
            case 'avi':
                supported = browser.tizen || browser.edgeUwp;
                break;
            case 'mpg':
            case 'mpeg':
                supported = browser.edgeUwp || browser.tizen;
                break;
            case '3gp':
            case 'flv':
            case 'mts':
            case 'trp':
            case 'vob':
            case 'vro':
                supported = browser.tizen;
                break;
            case 'mov':
                supported = browser.tizen || browser.chrome || browser.edgeUwp;
                videoCodecs.push('h264');
                break;
            case 'm2ts':
                supported = browser.tizen || browser.web0s || browser.edgeUwp;
                videoCodecs.push('h264');
                break;
            case 'wmv':
                supported = browser.tizen || browser.web0s || browser.edgeUwp;
                videoAudioCodecs = [];
                break;
            case 'ts':
                supported = testCanPlayTs();
                videoCodecs.push('h264');
                if (canPlayH265()) {
                    videoCodecs.push('h265');
                    videoCodecs.push('hevc');
                }
                profileContainer = 'ts,mpegts';
                break;
            default:
                break;
        }

        if (!supported) {
            return null;
        }

        return {
            Container: profileContainer,
            Type: 'Video',
            VideoCodec: videoCodecs.join(','),
            AudioCodec: videoAudioCodecs.join(',')
        };
    }

    function getMaxBitrate() {

        return 120000000;
    }

    return function (options) {

        options = options || {};
        var physicalAudioChannels = options.audioChannels || (browser.mobile ? 2 : 6);

        var bitrateSetting = getMaxBitrate();

        var videoTestElement = document.createElement('video');

        var canPlayWebm = videoTestElement.canPlayType('video/webm').replace(/no/, '');

        var canPlayMkv = testCanPlayMkv(videoTestElement);

        var profile = {};

        profile.MaxStreamingBitrate = bitrateSetting;
        profile.MaxStaticBitrate = 100000000;
        profile.MusicStreamingTranscodingBitrate = Math.min(bitrateSetting, 192000);

        profile.DirectPlayProfiles = [];

        var videoAudioCodecs = [];
        var hlsVideoAudioCodecs = [];

        var supportsMp3VideoAudio = videoTestElement.canPlayType('video/mp4; codecs="avc1.640029, mp4a.69"').replace(/no/, '') ||
            videoTestElement.canPlayType('video/mp4; codecs="avc1.640029, mp4a.6B"').replace(/no/, '');

        // Only put mp3 first if mkv support is there
        // Otherwise with HLS and mp3 audio we're seeing some browsers
        // safari is lying
        if ((videoTestElement.canPlayType('audio/mp4; codecs="ac-3"').replace(/no/, '') && !browser.osx && !browser.iOS) || browser.edgeUwp || browser.tizen || browser.web0s) {
            videoAudioCodecs.push('ac3');

            // This works in edge desktop, but not mobile
            // TODO: Retest this on mobile
            if (!browser.edge || !browser.touch || browser.edgeUwp) {
                hlsVideoAudioCodecs.push('ac3');
            }
        }

        if (browser.tizen) {
            videoAudioCodecs.push('eac3');
            hlsVideoAudioCodecs.push('eac3');
        }

        var mp3Added = false;
        if (canPlayMkv) {
            if (supportsMp3VideoAudio) {
                mp3Added = true;
                videoAudioCodecs.push('mp3');
            }
        }
        if (videoTestElement.canPlayType('video/mp4; codecs="avc1.640029, mp4a.40.2"').replace(/no/, '')) {
            videoAudioCodecs.push('aac');
            hlsVideoAudioCodecs.push('aac');
        }
        if (supportsMp3VideoAudio) {
            if (!mp3Added) {
                videoAudioCodecs.push('mp3');
            }
            if (!browser.ps4) {
                // PS4 fails to load HLS with mp3 audio
                hlsVideoAudioCodecs.push('mp3');
            }
        }

        if (browser.tizen || options.supportsDts) {
            videoAudioCodecs.push('dca');
            videoAudioCodecs.push('dts');
        }

        if (options.supportsTrueHd) {
            videoAudioCodecs.push('truehd');
        }

        videoAudioCodecs = videoAudioCodecs.filter(function (c) {
            return (options.disableVideoAudioCodecs || []).indexOf(c) === -1;
        });

        hlsVideoAudioCodecs = hlsVideoAudioCodecs.filter(function (c) {
            return (options.disableHlsVideoAudioCodecs || []).indexOf(c) === -1;
        });

        var mp4VideoCodecs = [];
        if (canPlayH264()) {
            mp4VideoCodecs.push('h264');
        }
        if (canPlayH265()) {
            mp4VideoCodecs.push('h265');
            mp4VideoCodecs.push('hevc');
        }

        if (mp4VideoCodecs.length) {
            profile.DirectPlayProfiles.push({
                Container: 'mp4,m4v',
                Type: 'Video',
                VideoCodec: mp4VideoCodecs.join(','),
                AudioCodec: videoAudioCodecs.join(',')
            });
        }

        if (browser.tizen) {
            mp4VideoCodecs.push('mpeg2video');
            mp4VideoCodecs.push('vc1');
        }

        if (canPlayMkv && mp4VideoCodecs.length) {
            profile.DirectPlayProfiles.push({
                Container: 'mkv',
                Type: 'Video',
                VideoCodec: mp4VideoCodecs.join(','),
                AudioCodec: videoAudioCodecs.join(',')
            });

            if (browser.edgeUwp) {
                profile.DirectPlayProfiles.push({
                    Container: 'mkv',
                    Type: 'Video',
                    VideoCodec: 'vc1',
                    AudioCodec: videoAudioCodecs.join(',')
                });
            }
        }

        // These are formats we can't test for but some devices will support
        ['m2ts', 'mov', 'wmv', 'ts', 'asf', 'avi', 'mpg', 'mpeg'].map(function (container) {
            return getDirectPlayProfileForVideoContainer(container, videoAudioCodecs);
        }).filter(function (i) {
            return i != null;
        }).forEach(function (i) {
            profile.DirectPlayProfiles.push(i);
        });

        ['opus', 'mp3', 'aac', 'flac', 'webma', 'wma', 'wav'].filter(canPlayAudioFormat).forEach(function (audioFormat) {

            profile.DirectPlayProfiles.push({
                Container: audioFormat === 'webma' ? 'webma,webm' : audioFormat,
                Type: 'Audio'
            });

            // aac also appears in the m4a container
            if (audioFormat === 'aac') {
                profile.DirectPlayProfiles.push({
                    Container: 'm4a',
                    AudioCodec: audioFormat,
                    Type: 'Audio'
                });
            }
        });

        if (canPlayWebm) {
            profile.DirectPlayProfiles.push({
                Container: 'webm',
                Type: 'Video'
            });
        }

        profile.TranscodingProfiles = [];

        if (canPlayNativeHls() && options.enableHlsAudio) {
            profile.TranscodingProfiles.push({
                Container: 'ts',
                Type: 'Audio',
                AudioCodec: 'aac',
                Context: 'Streaming',
                Protocol: 'hls'
            });
        }

        ['opus', 'mp3', 'aac', 'wav'].filter(canPlayAudioFormat).forEach(function (audioFormat) {

            profile.TranscodingProfiles.push({
                Container: audioFormat,
                Type: 'Audio',
                AudioCodec: audioFormat,
                Context: 'Streaming',
                Protocol: 'http',
                MaxAudioChannels: physicalAudioChannels.toString()
            });
            profile.TranscodingProfiles.push({
                Container: audioFormat,
                Type: 'Audio',
                AudioCodec: audioFormat,
                Context: 'Static',
                Protocol: 'http',
                MaxAudioChannels: physicalAudioChannels.toString()
            });
        });

        // Can't use mkv on mobile because we have to use the native player controls and they won't be able to seek it
        if (canPlayMkv && !browser.tizen && options.enableMkvProgressive !== false) {
            profile.TranscodingProfiles.push({
                Container: 'mkv',
                Type: 'Video',
                AudioCodec: videoAudioCodecs.join(','),
                VideoCodec: 'h264',
                Context: 'Streaming',
                MaxAudioChannels: physicalAudioChannels.toString(),
                CopyTimestamps: true
            });
        }

        if (canPlayHls() && options.enableHls !== false) {
            profile.TranscodingProfiles.push({
                Container: 'ts',
                Type: 'Video',
                AudioCodec: hlsVideoAudioCodecs.join(','),
                VideoCodec: 'h264',
                Context: 'Streaming',
                Protocol: 'hls',
                MaxAudioChannels: physicalAudioChannels.toString()
            });
        }

        // Put mp4 ahead of webm
        if (browser.firefox) {
            profile.TranscodingProfiles.push({
                Container: 'mp4',
                Type: 'Video',
                AudioCodec: videoAudioCodecs.join(','),
                VideoCodec: 'h264',
                Context: 'Streaming',
                Protocol: 'http'
                // Edit: Can't use this in firefox because we're seeing situations of no sound when downmixing from 6 channel to 2
                //MaxAudioChannels: physicalAudioChannels.toString()
            });
        }

        if (canPlayWebm) {
            profile.TranscodingProfiles.push({
                Container: 'webm',
                Type: 'Video',
                AudioCodec: 'vorbis',
                VideoCodec: 'vpx',
                Context: 'Streaming',
                Protocol: 'http',
                // If audio transcoding is needed, limit channels to number of physical audio channels
                // Trying to transcode to 5 channels when there are only 2 speakers generally does not sound good
                MaxAudioChannels: physicalAudioChannels.toString()
            });
        }

        profile.TranscodingProfiles.push({
            Container: 'mp4',
            Type: 'Video',
            AudioCodec: videoAudioCodecs.join(','),
            VideoCodec: 'h264',
            Context: 'Streaming',
            Protocol: 'http',
            // If audio transcoding is needed, limit channels to number of physical audio channels
            // Trying to transcode to 5 channels when there are only 2 speakers generally does not sound good
            MaxAudioChannels: physicalAudioChannels.toString()
        });

        profile.TranscodingProfiles.push({
            Container: 'mp4',
            Type: 'Video',
            AudioCodec: videoAudioCodecs.join(','),
            VideoCodec: 'h264',
            Context: 'Static',
            Protocol: 'http'
        });

        profile.ContainerProfiles = [];

        profile.CodecProfiles = [];

        var supportsSecondaryAudio = browser.tizen;

        // Handle he-aac not supported
        if (!videoTestElement.canPlayType('video/mp4; codecs="avc1.640029, mp4a.40.5"').replace(/no/, '')) {
            profile.CodecProfiles.push({
                Type: 'VideoAudio',
                Codec: 'aac',
                Conditions: [
                    {
                        Condition: 'NotEquals',
                        Property: 'AudioProfile',
                        Value: 'HE-AAC'
                    },
                    {
                        Condition: 'LessThanEqual',
                        Property: 'AudioBitrate',
                        Value: '128000'
                    }
                ]
            });

            if (!supportsSecondaryAudio) {
                profile.CodecProfiles[profile.CodecProfiles.length - 1].Conditions.push({
                    Condition: 'Equals',
                    Property: 'IsSecondaryAudio',
                    Value: 'false',
                    IsRequired: 'false'
                });
            }
        }

        if (!supportsSecondaryAudio) {
            profile.CodecProfiles.push({
                Type: 'VideoAudio',
                Conditions: [
                    {
                        Condition: 'Equals',
                        Property: 'IsSecondaryAudio',
                        Value: 'false',
                        IsRequired: 'false'
                    }
                ]
            });
        }

        var maxLevel = '41';

        if (browser.chrome && !browser.mobile) {
            maxLevel = '51';
        }

        profile.CodecProfiles.push({
            Type: 'Video',
            Codec: 'h264',
            Conditions: [
            {
                Condition: 'NotEquals',
                Property: 'IsAnamorphic',
                Value: 'true',
                IsRequired: false
            },
            {
                Condition: 'EqualsAny',
                Property: 'VideoProfile',
                Value: 'high|main|baseline|constrained baseline'
            },
            {
                Condition: 'LessThanEqual',
                Property: 'VideoLevel',
                Value: maxLevel
            }]
        });

        if (!browser.edgeUwp && !browser.tizen && !browser.web0s) {
            profile.CodecProfiles[profile.CodecProfiles.length - 1].Conditions.push({
                Condition: 'NotEquals',
                Property: 'IsAVC',
                Value: 'false',
                IsRequired: false
            });
        }

        var isTizenFhd = false;
        if (browser.tizen) {
            try {
                var isTizenUhd = webapis.productinfo.isUdPanelSupported();
                isTizenFhd = !isTizenUhd;
                console.log("isTizenFhd = " + isTizenFhd);
            } catch (error) {
                console.log("isUdPanelSupported() error code = " + error.code);
            }
        }

        var globalMaxVideoBitrate = browser.ps4 ? '8000000' :
            (browser.xboxOne ? '10000000' :
            (browser.edgeUwp ? '40000000' :
            (browser.tizen && isTizenFhd ? '20000000' : '')));

        var h264MaxVideoBitrate = globalMaxVideoBitrate;
        if (browser.tizen && !isTizenFhd) {

            h264MaxVideoBitrate = '60000000';
        }

        if (h264MaxVideoBitrate) {
            profile.CodecProfiles[profile.CodecProfiles.length - 1].Conditions.push({
                Condition: 'LessThanEqual',
                Property: 'VideoBitrate',
                Value: h264MaxVideoBitrate,
                IsRequired: true
            });
        }

        if (globalMaxVideoBitrate) {
            profile.CodecProfiles.push({
                Type: 'Video',
                Conditions: [
                {
                    Condition: 'LessThanEqual',
                    Property: 'VideoBitrate',
                    Value: globalMaxVideoBitrate
                }]
            });
        }

        if (browser.tizen && !isTizenFhd) {
            profile.CodecProfiles.push({
                Type: 'Video',
                Codec: 'vp9',
                Conditions: [
                    {
                        Condition: 'LessThanEqual',
                        Property: 'VideoBitrate',
                        Value: '40000000'
                    }
                ]
            });
            profile.CodecProfiles.push({
                Type: 'Video',
                Codec: 'mpeg4,vc1,mpeg2video,mpeg1video,msmpeg4,h263,vp6,vp8',
                Conditions: [
                    {
                        Condition: 'LessThanEqual',
                        Property: 'VideoBitrate',
                        Value: '20000000'
                    }
                ]
            });
            // All others fall here
            profile.CodecProfiles.push({
                Type: 'Video',
                Conditions: [
                    {
                        Condition: 'LessThanEqual',
                        Property: 'VideoBitrate',
                        Value: '80000000'
                    }
                ]
            });
        }

        // Subtitle profiles
        // External vtt or burn in
        profile.SubtitleProfiles = [];
        if (supportsTextTracks()) {

            profile.SubtitleProfiles.push({
                Format: 'vtt',
                Method: 'External'
            });
        }

        profile.ResponseProfiles = [];

        profile.ResponseProfiles.push({
            Type: 'Video',
            Container: 'm4v',
            MimeType: 'video/mp4'
        });

        if (browser.chrome) {
            profile.ResponseProfiles.push({
                Type: 'Video',
                Container: 'mov',
                MimeType: 'video/webm'
            });
        }

        return profile;
    };
});