using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Controller.Devices;
using MediaBrowser.Controller.Dlna;
using MediaBrowser.Controller.Drawing;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.MediaEncoding;
using MediaBrowser.Model.IO;
using MediaBrowser.Model.Serialization;
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using MediaBrowser.Common.IO;
using MediaBrowser.Controller.IO;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.IO;
using MediaBrowser.Model.Dlna;
using MediaBrowser.Model.Services;

namespace MediaBrowser.Api.Playback.Progressive
{
    /// <summary>
    /// Class GetVideoStream
    /// </summary>
    [Route("/Videos/{Id}/stream.mpegts", "GET")]
    [Route("/Videos/{Id}/stream.ts", "GET")]
    [Route("/Videos/{Id}/stream.webm", "GET")]
    [Route("/Videos/{Id}/stream.asf", "GET")]
    [Route("/Videos/{Id}/stream.wmv", "GET")]
    [Route("/Videos/{Id}/stream.ogv", "GET")]
    [Route("/Videos/{Id}/stream.mp4", "GET")]
    [Route("/Videos/{Id}/stream.m4v", "GET")]
    [Route("/Videos/{Id}/stream.mkv", "GET")]
    [Route("/Videos/{Id}/stream.mpeg", "GET")]
    [Route("/Videos/{Id}/stream.mpg", "GET")]
    [Route("/Videos/{Id}/stream.avi", "GET")]
    [Route("/Videos/{Id}/stream.m2ts", "GET")]
    [Route("/Videos/{Id}/stream.3gp", "GET")]
    [Route("/Videos/{Id}/stream.wmv", "GET")]
    [Route("/Videos/{Id}/stream.wtv", "GET")]
    [Route("/Videos/{Id}/stream.mov", "GET")]
    [Route("/Videos/{Id}/stream.iso", "GET")]
    [Route("/Videos/{Id}/stream.flv", "GET")]
    [Route("/Videos/{Id}/stream", "GET")]
    [Route("/Videos/{Id}/stream.ts", "HEAD")]
    [Route("/Videos/{Id}/stream.webm", "HEAD")]
    [Route("/Videos/{Id}/stream.asf", "HEAD")]
    [Route("/Videos/{Id}/stream.wmv", "HEAD")]
    [Route("/Videos/{Id}/stream.ogv", "HEAD")]
    [Route("/Videos/{Id}/stream.mp4", "HEAD")]
    [Route("/Videos/{Id}/stream.m4v", "HEAD")]
    [Route("/Videos/{Id}/stream.mkv", "HEAD")]
    [Route("/Videos/{Id}/stream.mpeg", "HEAD")]
    [Route("/Videos/{Id}/stream.mpg", "HEAD")]
    [Route("/Videos/{Id}/stream.avi", "HEAD")]
    [Route("/Videos/{Id}/stream.3gp", "HEAD")]
    [Route("/Videos/{Id}/stream.wmv", "HEAD")]
    [Route("/Videos/{Id}/stream.wtv", "HEAD")]
    [Route("/Videos/{Id}/stream.m2ts", "HEAD")]
    [Route("/Videos/{Id}/stream.mov", "HEAD")]
    [Route("/Videos/{Id}/stream.iso", "HEAD")]
    [Route("/Videos/{Id}/stream.flv", "HEAD")]
    [Route("/Videos/{Id}/stream", "HEAD")]
    public class GetVideoStream : VideoStreamRequest
    {

    }

    /// <summary>
    /// Class VideoService
    /// </summary>
    public class VideoService : BaseProgressiveStreamingService
    {
        public VideoService(IServerConfigurationManager serverConfig, IUserManager userManager, ILibraryManager libraryManager, IIsoManager isoManager, IMediaEncoder mediaEncoder, IFileSystem fileSystem, IDlnaManager dlnaManager, ISubtitleEncoder subtitleEncoder, IDeviceManager deviceManager, IMediaSourceManager mediaSourceManager, IZipClient zipClient, IJsonSerializer jsonSerializer, IAuthorizationContext authorizationContext, IImageProcessor imageProcessor) : base(serverConfig, userManager, libraryManager, isoManager, mediaEncoder, fileSystem, dlnaManager, subtitleEncoder, deviceManager, mediaSourceManager, zipClient, jsonSerializer, authorizationContext, imageProcessor)
        {
        }

        /// <summary>
        /// Gets the specified request.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>System.Object.</returns>
        public Task<object> Get(GetVideoStream request)
        {
            return ProcessRequest(request, false);
        }

        /// <summary>
        /// Heads the specified request.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>System.Object.</returns>
        public Task<object> Head(GetVideoStream request)
        {
            return ProcessRequest(request, true);
        }

        protected override string GetCommandLineArguments(string outputPath, StreamState state, bool isEncoding)
        {
            var encodingOptions = ApiEntryPoint.Instance.GetEncodingOptions();

            // Get the output codec name
            var videoCodec = EncodingHelper.GetVideoEncoder(state, encodingOptions);

            var format = string.Empty;
            var keyFrame = string.Empty;

            if (string.Equals(Path.GetExtension(outputPath), ".mp4", StringComparison.OrdinalIgnoreCase))
            {
                // Comparison: https://github.com/jansmolders86/mediacenterjs/blob/master/lib/transcoding/desktop.js
                format = " -f mp4 -movflags frag_keyframe+empty_moov";
            }

            var threads = EncodingHelper.GetNumberOfThreads(state, encodingOptions, string.Equals(videoCodec, "libvpx", StringComparison.OrdinalIgnoreCase));

            var inputModifier = EncodingHelper.GetInputModifier(state, encodingOptions);

            var subtitleArguments = state.SubtitleStream != null &&
                                    state.SubtitleDeliveryMethod == SubtitleDeliveryMethod.Embed
                ? GetSubtitleArguments(state)
                : string.Empty;

            return string.Format("{0} {1}{2} {3} {4} -map_metadata -1 -map_chapters -1 -threads {5} {6}{7}{8} -y \"{9}\"",
                inputModifier,
                EncodingHelper.GetInputArgument(state, encodingOptions),
                keyFrame,
                EncodingHelper.GetMapArgs(state),
                GetVideoArguments(state, videoCodec),
                threads,
                GetAudioArguments(state),
                subtitleArguments,
                format,
                outputPath
                ).Trim();
        }

        private string GetSubtitleArguments(StreamState state)
        {
            var format = state.SupportedSubtitleCodecs.FirstOrDefault();
            string codec;

            if (string.IsNullOrWhiteSpace(format) || string.Equals(format, state.SubtitleStream.Codec, StringComparison.OrdinalIgnoreCase))
            {
                codec = "copy";
            }
            else
            {
                codec = format;
            }

            return " -codec:s:0 " + codec;
        }

        /// <summary>
        /// Gets video arguments to pass to ffmpeg
        /// </summary>
        /// <param name="state">The state.</param>
        /// <param name="videoCodec">The video codec.</param>
        /// <returns>System.String.</returns>
        private string GetVideoArguments(StreamState state, string videoCodec)
        {
            var args = "-codec:v:0 " + videoCodec;

            if (state.EnableMpegtsM2TsMode)
            {
                args += " -mpegts_m2ts_mode 1";
            }

            if (string.Equals(videoCodec, "copy", StringComparison.OrdinalIgnoreCase))
            {
                if (state.VideoStream != null && EncodingHelper.IsH264(state.VideoStream) && string.Equals(state.OutputContainer, "ts", StringComparison.OrdinalIgnoreCase) && !string.Equals(state.VideoStream.NalLengthSize, "0", StringComparison.OrdinalIgnoreCase))
                {
                    args += " -bsf:v h264_mp4toannexb";
                }

                if (state.RunTimeTicks.HasValue && state.VideoRequest.CopyTimestamps)
                {
                    args += " -copyts -avoid_negative_ts disabled -start_at_zero";
                }

                if (!state.RunTimeTicks.HasValue)
                {
                    args += " -flags -global_header -fflags +genpts";
                }

                return args;
            }

            var keyFrameArg = string.Format(" -force_key_frames \"expr:gte(t,n_forced*{0})\"",
                5.ToString(UsCulture));

            args += keyFrameArg;

            var hasGraphicalSubs = state.SubtitleStream != null && !state.SubtitleStream.IsTextSubtitleStream && state.VideoRequest.SubtitleMethod == SubtitleDeliveryMethod.Encode;

            var hasCopyTs = false;
            // Add resolution params, if specified
            if (!hasGraphicalSubs)
            {
                var outputSizeParam = EncodingHelper.GetOutputSizeParam(state, videoCodec);
                args += outputSizeParam;
                hasCopyTs = outputSizeParam.IndexOf("copyts", StringComparison.OrdinalIgnoreCase) != -1;
            }

            if (state.RunTimeTicks.HasValue && state.VideoRequest.CopyTimestamps)
            {
                if (!hasCopyTs)
                {
                    args += " -copyts";
                }
                args += " -avoid_negative_ts disabled -start_at_zero";
            }

            var encodingOptions = ApiEntryPoint.Instance.GetEncodingOptions();
            var qualityParam = EncodingHelper.GetVideoQualityParam(state, videoCodec, encodingOptions, GetDefaultH264Preset());

            if (!string.IsNullOrEmpty(qualityParam))
            {
                args += " " + qualityParam.Trim();
            }

            // This is for internal graphical subs
            if (hasGraphicalSubs)
            {
                args += EncodingHelper.GetGraphicalSubtitleParam(state, videoCodec);
            }

            if (!state.RunTimeTicks.HasValue)
            {
                args += " -flags -global_header";
            }

            return args;
        }

        /// <summary>
        /// Gets audio arguments to pass to ffmpeg
        /// </summary>
        /// <param name="state">The state.</param>
        /// <returns>System.String.</returns>
        private string GetAudioArguments(StreamState state)
        {
            // If the video doesn't have an audio stream, return a default.
            if (state.AudioStream == null && state.VideoStream != null)
            {
                return string.Empty;
            }

            // Get the output codec name
            var codec = EncodingHelper.GetAudioEncoder(state);

            var args = "-codec:a:0 " + codec;

            if (string.Equals(codec, "copy", StringComparison.OrdinalIgnoreCase))
            {
                return args;
            }

            // Add the number of audio channels
            var channels = state.OutputAudioChannels;

            if (channels.HasValue)
            {
                args += " -ac " + channels.Value;
            }

            var bitrate = state.OutputAudioBitrate;

            if (bitrate.HasValue)
            {
                args += " -ab " + bitrate.Value.ToString(UsCulture);
            }

            args += " " + EncodingHelper.GetAudioFilterParam(state, ApiEntryPoint.Instance.GetEncodingOptions(), false);

            return args;
        }
    }
}