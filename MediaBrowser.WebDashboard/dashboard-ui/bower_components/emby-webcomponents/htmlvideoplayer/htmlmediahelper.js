define(["appSettings","browser","events"],function(appSettings,browser,events){"use strict";function getSavedVolume(){return appSettings.get("volume")||1}function saveVolume(value){value&&appSettings.set("volume",value)}function getCrossOriginValue(mediaSource){return mediaSource.IsRemote?null:"anonymous"}function canPlayNativeHls(){var media=document.createElement("video");return!(!media.canPlayType("application/x-mpegURL").replace(/no/,"")&&!media.canPlayType("application/vnd.apple.mpegURL").replace(/no/,""))}function enableHlsPlayer(item,mediaSource,mediaType){if(null==window.MediaSource)return!1;if(browser.iOS)return!1;if(canPlayNativeHls()){if(browser.edge&&"Video"===mediaType)return!0;if(mediaSource.RunTimeTicks)return!1}return!0}function handleMediaError(instance,reject){var hlsPlayer=instance._hlsPlayer;if(hlsPlayer){var now=Date.now();window.performance&&window.performance.now&&(now=performance.now()),!recoverDecodingErrorDate||now-recoverDecodingErrorDate>3e3?(recoverDecodingErrorDate=now,console.log("try to recover media Error ..."),hlsPlayer.recoverMediaError()):!recoverSwapAudioCodecDate||now-recoverSwapAudioCodecDate>3e3?(recoverSwapAudioCodecDate=now,console.log("try to swap Audio Codec and recover media Error ..."),hlsPlayer.swapAudioCodec(),hlsPlayer.recoverMediaError()):(console.error("cannot recover, last media error recovery failed ..."),reject?reject():onErrorInternal(instance,"mediadecodeerror"))}}function onErrorInternal(instance,type){instance.destroyCustomTrack&&instance.destroyCustomTrack(instance._mediaElement),events.trigger(instance,"error",[{type:type}])}function isValidDuration(duration){return!(!duration||isNaN(duration)||duration===Number.POSITIVE_INFINITY||duration===Number.NEGATIVE_INFINITY)}function setCurrentTimeIfNeeded(element,seconds){Math.abs(element.currentTime||0,seconds)<=1&&(element.currentTime=seconds)}function seekOnPlaybackStart(instance,element,ticks){var seconds=(ticks||0)/1e7;if(seconds){var delay=((instance.currentSrc()||"").toLowerCase(),browser.safari?2500:0);delay?setTimeout(function(){setCurrentTimeIfNeeded(element,seconds)},delay):setCurrentTimeIfNeeded(element,seconds)}}function applySrc(elem,src,options){return window.Windows&&options.mediaSource&&options.mediaSource.IsLocal?Windows.Storage.StorageFile.getFileFromPathAsync(options.url).then(function(file){var playlist=new Windows.Media.Playback.MediaPlaybackList,source1=Windows.Media.Core.MediaSource.createFromStorageFile(file),startTime=(options.playerStartPositionTicks||0)/1e4;return playlist.items.append(new Windows.Media.Playback.MediaPlaybackItem(source1,startTime)),elem.src=URL.createObjectURL(playlist,{oneTimeOnly:!0}),Promise.resolve()}):(elem.src=src,Promise.resolve())}function onSuccessfulPlay(elem,onErrorFn){elem.addEventListener("error",onErrorFn)}function playWithPromise(elem,onErrorFn){try{var promise=elem.play();return promise&&promise.then?promise.catch(function(e){var errorName=(e.name||"").toLowerCase();return"notallowederror"===errorName||"aborterror"===errorName?(onSuccessfulPlay(elem,onErrorFn),Promise.resolve()):Promise.reject()}):(onSuccessfulPlay(elem,onErrorFn),Promise.resolve())}catch(err){return console.log("error calling video.play: "+err),Promise.reject()}}function destroyHlsPlayer(instance){var player=instance._hlsPlayer;if(player){try{player.destroy()}catch(err){console.log(err)}instance._hlsPlayer=null}}function bindEventsToHlsPlayer(instance,hls,elem,onErrorFn,resolve,reject){hls.on(Hls.Events.MANIFEST_PARSED,function(){playWithPromise(elem,onErrorFn).then(resolve,function(){reject&&(reject(),reject=null)})}),hls.on(Hls.Events.ERROR,function(event,data){if(console.log("HLS Error: Type: "+data.type+" Details: "+(data.details||"")+" Fatal: "+(data.fatal||!1)),data.fatal)switch(data.type){case Hls.ErrorTypes.NETWORK_ERROR:data.response&&data.response.code&&data.response.code>=400&&data.response.code<500?(console.log("hls.js response error code: "+data.response.code),reject?(reject(),reject=null):onErrorInternal("network")):(console.log("fatal network error encountered, try to recover"),hls.startLoad());break;case Hls.ErrorTypes.MEDIA_ERROR:console.log("fatal media error encountered, try to recover");var currentReject=reject;reject=null,handleMediaError(instance,currentReject);break;default:hls.destroy(),reject?(reject(),reject=null):onErrorInternal("mediadecodeerror")}})}function onEndedInternal(instance,elem,onErrorFn){elem.removeEventListener("error",onErrorFn),elem.src="",elem.innerHTML="",elem.removeAttribute("src"),destroyHlsPlayer(instance),instance.originalDocumentTitle&&(document.title=instance.originalDocumentTitle,instance.originalDocumentTitle=null);var stopInfo={src:instance._currentSrc};events.trigger(instance,"stopped",[stopInfo]),instance._currentTime=null,instance._currentSrc=null,instance._currentPlayOptions=null}function getBufferedRanges(instance,elem){var offset,ranges=[],seekable=elem.buffered||[],currentPlayOptions=instance._currentPlayOptions;currentPlayOptions&&(offset=currentPlayOptions.transcodingOffsetTicks),offset=offset||0;for(var i=0,length=seekable.length;i<length;i++){var start=seekable.start(i),end=seekable.end(i);isValidDuration(start)||(start=0),isValidDuration(end)?ranges.push({start:1e7*start+offset,end:1e7*end+offset}):end=0}return ranges}var recoverDecodingErrorDate,recoverSwapAudioCodecDate;return{getSavedVolume:getSavedVolume,saveVolume:saveVolume,enableHlsPlayer:enableHlsPlayer,handleMediaError:handleMediaError,isValidDuration:isValidDuration,onErrorInternal:onErrorInternal,seekOnPlaybackStart:seekOnPlaybackStart,applySrc:applySrc,playWithPromise:playWithPromise,destroyHlsPlayer:destroyHlsPlayer,bindEventsToHlsPlayer:bindEventsToHlsPlayer,onEndedInternal:onEndedInternal,getCrossOriginValue:getCrossOriginValue,getBufferedRanges:getBufferedRanges}});