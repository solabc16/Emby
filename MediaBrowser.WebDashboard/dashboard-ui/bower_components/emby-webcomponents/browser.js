define([],function(){"use strict";function isTv(){var userAgent=navigator.userAgent.toLowerCase();return userAgent.indexOf("tv")!==-1||(userAgent.indexOf("samsungbrowser")!==-1||(userAgent.indexOf("nintendo")!==-1||(userAgent.indexOf("viera")!==-1||userAgent.indexOf("webos")!==-1)))}function isMobile(userAgent){for(var terms=["mobi","ipad","iphone","ipod","silk","gt-p1000","nexus 7","kindle fire","opera mini"],lower=userAgent.toLowerCase(),i=0,length=terms.length;i<length;i++)if(lower.indexOf(terms[i])!==-1)return!0;return!1}function isStyleSupported(prop,value){if("undefined"==typeof window)return!1;if(value=2===arguments.length?value:"inherit","CSS"in window&&"supports"in window.CSS)return window.CSS.supports(prop,value);if("supportsCSS"in window)return window.supportsCSS(prop,value);try{var camel=prop.replace(/-([a-z]|[0-9])/gi,function(all,letter){return(letter+"").toUpperCase()}),support=camel in el.style,el=document.createElement("div");return el.style.cssText=prop+":"+value,support&&""!==el.style[camel]}catch(err){return!1}}function hasKeyboard(browser){return!!browser.touch||(!!browser.xboxOne||(!!browser.ps4||(!!browser.edgeUwp||!!browser.tv)))}function supportsCssAnimation(allowPrefix){if(allowPrefix){if(_supportsCssAnimationWithPrefix===!0||_supportsCssAnimationWithPrefix===!1)return _supportsCssAnimationWithPrefix}else if(_supportsCssAnimation===!0||_supportsCssAnimation===!1)return _supportsCssAnimation;var animation=!1,animationstring="animation",keyframeprefix="",domPrefixes=["Webkit","O","Moz"],pfx="",elm=document.createElement("div");if(void 0!==elm.style.animationName&&(animation=!0),animation===!1&&allowPrefix)for(var i=0;i<domPrefixes.length;i++)if(void 0!==elm.style[domPrefixes[i]+"AnimationName"]){pfx=domPrefixes[i],animationstring=pfx+"Animation",keyframeprefix="-"+pfx.toLowerCase()+"-",animation=!0;break}return allowPrefix?_supportsCssAnimationWithPrefix=animation:_supportsCssAnimation=animation}var _supportsCssAnimation,_supportsCssAnimationWithPrefix,uaMatch=function(ua){ua=ua.toLowerCase();var match=/(edge)[ \/]([\w.]+)/.exec(ua)||/(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua)||/(opr)(?:.*version|)[ \/]([\w.]+)/.exec(ua)||/(chrome)[ \/]([\w.]+)/.exec(ua)||/(safari)[ \/]([\w.]+)/.exec(ua)||/(firefox)[ \/]([\w.]+)/.exec(ua)||/(msie) ([\w.]+)/.exec(ua)||ua.indexOf("compatible")<0&&/(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua)||[],versionMatch=/(version)[ \/]([\w.]+)/.exec(ua),platform_match=/(ipad)/.exec(ua)||/(iphone)/.exec(ua)||/(android)/.exec(ua)||[],browser=match[1]||"";"edge"===browser?platform_match=[""]:ua.indexOf("windows phone")!==-1||ua.indexOf("iemobile")!==-1?browser="msie":ua.indexOf("like gecko")!==-1&&ua.indexOf("webkit")===-1&&ua.indexOf("opera")===-1&&ua.indexOf("chrome")===-1&&ua.indexOf("safari")===-1&&(browser="msie"),"opr"===browser&&(browser="opera");var version;versionMatch&&versionMatch.length>2&&(version=versionMatch[2]),version=version||match[2]||"0";var versionMajor=parseInt(version.split(".")[0]);return isNaN(versionMajor)&&(versionMajor=0),{browser:browser,version:version,platform:platform_match[0]||"",versionMajor:versionMajor}},userAgent=navigator.userAgent,matched=uaMatch(userAgent),browser={};return matched.browser&&(browser[matched.browser]=!0,browser.version=matched.version,browser.versionMajor=matched.versionMajor),matched.platform&&(browser[matched.platform]=!0),browser.chrome||browser.msie||browser.edge||browser.opera||userAgent.toLowerCase().indexOf("webkit")===-1||(browser.safari=!0),userAgent.toLowerCase().indexOf("playstation 4")!==-1&&(browser.ps4=!0,browser.tv=!0),userAgent.toLowerCase().indexOf("embytheaterpi")!==-1&&(browser.slow=!0,browser.noAnimation=!0),isMobile(userAgent)&&(browser.mobile=!0),browser.xboxOne=userAgent.toLowerCase().indexOf("xbox")!==-1,browser.animate="undefined"!=typeof document&&null!=document.documentElement.animate,browser.tizen=userAgent.toLowerCase().indexOf("tizen")!==-1||null!=self.tizen,browser.web0s=userAgent.toLowerCase().indexOf("Web0S".toLowerCase())!==-1,browser.edgeUwp=browser.edge&&userAgent.toLowerCase().indexOf("msapphost")!==-1,browser.tizen||(browser.orsay=userAgent.toLowerCase().indexOf("smarthub")!==-1),browser.edgeUwp&&(browser.edge=!0),browser.tv=isTv(),browser.operaTv=browser.tv&&userAgent.toLowerCase().indexOf("opr/")!==-1,isStyleSupported("display","flex")||(browser.noFlex=!0),(browser.mobile||browser.tv)&&(browser.slow=!0),"undefined"!=typeof document&&("ontouchstart"in window||window.DocumentTouch&&document instanceof DocumentTouch)&&(browser.touch=!0),browser.keyboard=hasKeyboard(browser),browser.supportsCssAnimation=supportsCssAnimation,browser.osx=userAgent.toLowerCase().indexOf("os x")!==-1,browser.iOS=browser.ipad||browser.iphone||browser.ipod,browser});