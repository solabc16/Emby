﻿using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Emby.Server.Implementations.LiveTv.TunerHosts;
using MediaBrowser.Model.IO;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Extensions;
using MediaBrowser.Common.IO;
using MediaBrowser.Common.Net;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Controller.IO;
using MediaBrowser.Controller.LiveTv;
using MediaBrowser.Controller.MediaEncoding;
using MediaBrowser.Model.Dto;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.LiveTv;
using MediaBrowser.Model.Logging;
using MediaBrowser.Model.MediaInfo;
using MediaBrowser.Model.Serialization;

namespace MediaBrowser.Server.Implementations.LiveTv.TunerHosts.SatIp
{
    public class SatIpHost : BaseTunerHost, ITunerHost
    {
        private readonly IFileSystem _fileSystem;
        private readonly IHttpClient _httpClient;
        private readonly IServerApplicationHost _appHost;

        public SatIpHost(IServerConfigurationManager config, ILogger logger, IJsonSerializer jsonSerializer, IMediaEncoder mediaEncoder, IFileSystem fileSystem, IHttpClient httpClient, IServerApplicationHost appHost)
            : base(config, logger, jsonSerializer, mediaEncoder)
        {
            _fileSystem = fileSystem;
            _httpClient = httpClient;
            _appHost = appHost;
        }

        private const string ChannelIdPrefix = "sat_";

        protected override async Task<IEnumerable<ChannelInfo>> GetChannelsInternal(TunerHostInfo tuner, CancellationToken cancellationToken)
        {
            if (!string.IsNullOrWhiteSpace(tuner.M3UUrl))
            {
                return await new M3uParser(Logger, _fileSystem, _httpClient, _appHost).Parse(tuner.M3UUrl, ChannelIdPrefix, tuner.Id, false, cancellationToken).ConfigureAwait(false);
            }

            var channels = await new ChannelScan(Logger).Scan(tuner, cancellationToken).ConfigureAwait(false);
            return channels;
        }

        public static string DeviceType
        {
            get { return "satip"; }
        }

        public override string Type
        {
            get { return DeviceType; }
        }

        protected override async Task<List<MediaSourceInfo>> GetChannelStreamMediaSources(TunerHostInfo tuner, string channelId, CancellationToken cancellationToken)
        {
            var urlHash = tuner.Url.GetMD5().ToString("N");
            var prefix = ChannelIdPrefix + urlHash;
            if (!channelId.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            var channels = await GetChannels(tuner, true, cancellationToken).ConfigureAwait(false);
            var m3uchannels = channels.Cast<M3UChannel>();
            var channel = m3uchannels.FirstOrDefault(c => string.Equals(c.Id, channelId, StringComparison.OrdinalIgnoreCase));
            if (channel != null)
            {
                var path = channel.Path;
                MediaProtocol protocol = MediaProtocol.File;
                if (path.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                {
                    protocol = MediaProtocol.Http;
                }
                else if (path.StartsWith("rtmp", StringComparison.OrdinalIgnoreCase))
                {
                    protocol = MediaProtocol.Rtmp;
                }
                else if (path.StartsWith("rtsp", StringComparison.OrdinalIgnoreCase))
                {
                    protocol = MediaProtocol.Rtsp;
                }

                var mediaSource = new MediaSourceInfo
                {
                    Path = channel.Path,
                    Protocol = protocol,
                    MediaStreams = new List<MediaStream>
                    {
                        new MediaStream
                        {
                            Type = MediaStreamType.Video,
                            // Set the index to -1 because we don't know the exact index of the video stream within the container
                            Index = -1,
                            IsInterlaced = true
                        },
                        new MediaStream
                        {
                            Type = MediaStreamType.Audio,
                            // Set the index to -1 because we don't know the exact index of the audio stream within the container
                            Index = -1

                        }
                    },
                    RequiresOpening = false,
                    RequiresClosing = false
                };

                mediaSource.InferTotalBitrate(true);

                return new List<MediaSourceInfo> { mediaSource };
            }
            return new List<MediaSourceInfo>();
        }

        protected override async Task<LiveStream> GetChannelStream(TunerHostInfo tuner, string channelId, string streamId, CancellationToken cancellationToken)
        {
            var sources = await GetChannelStreamMediaSources(tuner, channelId, cancellationToken).ConfigureAwait(false);

            var liveStream = new LiveStream(sources.First());

            return liveStream;
        }

        protected override async Task<bool> IsAvailableInternal(TunerHostInfo tuner, string channelId, CancellationToken cancellationToken)
        {
            var updatedInfo = await SatIpDiscovery.Current.GetInfo(tuner.InfoUrl, cancellationToken).ConfigureAwait(false);

            return updatedInfo.TunersAvailable > 0;
        }

        protected override bool IsValidChannelId(string channelId)
        {
            return channelId.StartsWith(ChannelIdPrefix, StringComparison.OrdinalIgnoreCase);
        }

        public string Name
        {
            get { return "Sat IP"; }
        }

        public Task<List<LiveTvTunerInfo>> GetTunerInfos(CancellationToken cancellationToken)
        {
            var list = GetTunerHosts()
            .SelectMany(i => GetTunerInfos(i, cancellationToken))
            .ToList();

            return Task.FromResult(list);
        }

        public List<LiveTvTunerInfo> GetTunerInfos(TunerHostInfo info, CancellationToken cancellationToken)
        {
            var list = new List<LiveTvTunerInfo>();

            for (var i = 0; i < info.Tuners; i++)
            {
                list.Add(new LiveTvTunerInfo
                {
                    Name = info.FriendlyName ?? Name,
                    SourceType = Type,
                    Status = LiveTvTunerStatus.Available,
                    Id = info.Url.GetMD5().ToString("N") + i.ToString(CultureInfo.InvariantCulture),
                    Url = info.Url
                });
            }

            return list;
        }

        public string ApplyDuration(string streamPath, TimeSpan duration)
        {
            return streamPath;
        }
    }
}