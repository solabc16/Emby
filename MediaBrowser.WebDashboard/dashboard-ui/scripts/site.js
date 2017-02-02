﻿function getWindowLocationSearch(win) {
    'use strict';

    var search = (win || window).location.search;

    if (!search) {

        var index = window.location.href.indexOf('?');
        if (index != -1) {
            search = window.location.href.substring(index);
        }
    }

    return search || '';
}

function getParameterByName(name, url) {
    'use strict';

    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS, "i");

    var results = regex.exec(url || getWindowLocationSearch());
    if (results == null)
        return "";
    else
        return decodeURIComponent(results[1].replace(/\+/g, " "));
}

var Dashboard = {

    isConnectMode: function () {

        if (AppInfo.isNativeApp) {
            return true;
        }

        var url = window.location.href.toLowerCase();

        return url.indexOf('mediabrowser.tv') != -1 ||
            url.indexOf('emby.media') != -1;
    },

    isRunningInCordova: function () {

        return window.appMode == 'cordova';
    },

    onRequestFail: function (e, data) {

        if (data.status == 401) {

            if (data.errorCode == "ParentalControl") {

                var currentView = ViewManager.currentView();
                // Bounce to the login screen, but not if a password entry fails, obviously
                if (currentView && !currentView.classList.contains('.standalonePage')) {

                    Dashboard.alert({
                        message: Globalize.translate('MessageLoggedOutParentalControl'),
                        callback: function () {
                            Dashboard.logout(false);
                        }
                    });
                }

            }
        }
    },

    getCurrentUser: function () {

        return window.ApiClient.getCurrentUser();
    },

    serverAddress: function () {

        if (Dashboard.isConnectMode()) {
            var apiClient = window.ApiClient;

            if (apiClient) {
                return apiClient.serverAddress();
            }

            return null;
        }

        // Try to get the server address from the browser url
        // This will preserve protocol, hostname, port and subdirectory
        var urlLower = window.location.href.toLowerCase();
        var index = urlLower.lastIndexOf('/web');

        if (index != -1) {
            return urlLower.substring(0, index);
        }

        // If the above failed, just piece it together manually
        var loc = window.location;

        var address = loc.protocol + '//' + loc.hostname;

        if (loc.port) {
            address += ':' + loc.port;
        }

        return address;
    },

    getCurrentUserId: function () {

        var apiClient = window.ApiClient;

        if (apiClient) {
            return apiClient.getCurrentUserId();
        }

        return null;
    },

    onServerChanged: function (userId, accessToken, apiClient) {

        apiClient = apiClient || window.ApiClient;

        window.ApiClient = apiClient;
    },

    logout: function (logoutWithServer) {

        function onLogoutDone() {

            var loginPage;

            if (Dashboard.isConnectMode()) {
                loginPage = 'connectlogin.html';
                window.ApiClient = null;
            } else {
                loginPage = 'login.html';
            }
            Dashboard.navigate(loginPage);
        }

        if (logoutWithServer === false) {
            onLogoutDone();
        } else {
            ConnectionManager.logout().then(onLogoutDone);
        }
    },

    getConfigurationPageUrl: function (name) {
        return "configurationpage?name=" + encodeURIComponent(name);
    },

    navigate: function (url, preserveQueryString) {

        if (!url) {
            throw new Error('url cannot be null or empty');
        }

        var queryString = getWindowLocationSearch();
        if (preserveQueryString && queryString) {
            url += queryString;
        }

        return Emby.Page.show(url);
    },

    showLoadingMsg: function () {

        Dashboard.loadingVisible = true;

        require(['loading'], function (loading) {
            if (Dashboard.loadingVisible) {
                loading.show();
            } else {
                loading.hide();
            }
        });
    },

    hideLoadingMsg: function () {

        Dashboard.loadingVisible = false;

        require(['loading'], function (loading) {
            if (Dashboard.loadingVisible) {
                loading.show();
            } else {
                loading.hide();
            }
        });
    },

    processPluginConfigurationUpdateResult: function () {

        Dashboard.hideLoadingMsg();

        require(['toast'], function (toast) {
            toast(Globalize.translate('MessageSettingsSaved'));
        });
    },

    processServerConfigurationUpdateResult: function (result) {

        Dashboard.hideLoadingMsg();

        require(['toast'], function (toast) {
            toast(Globalize.translate('MessageSettingsSaved'));
        });
    },

    processErrorResponse: function (response) {

        Dashboard.hideLoadingMsg();

        var status = '' + response.status;

        if (response.statusText) {
            status = response.statusText;
        }

        Dashboard.alert({
            title: status,
            message: response.headers ? response.headers.get('X-Application-Error-Code') : null
        });
    },

    alert: function (options) {

        if (typeof options == "string") {

            require(['toast'], function (toast) {

                toast({
                    text: options
                });

            });

            return;
        }

        require(['alert'], function (alert) {
            alert({
                title: options.title || Globalize.translate('HeaderAlert'),
                text: options.message
            }).then(options.callback || function () { });
        });
    },

    restartServer: function () {

        var apiClient = window.ApiClient;

        if (!apiClient) {
            return;
        }

        Dashboard.suppressAjaxErrors = true;
        Dashboard.showLoadingMsg();

        apiClient.restartServer().then(function () {

            setTimeout(function () {
                Dashboard.reloadPageWhenServerAvailable();
            }, 250);

        }, function () {
            Dashboard.suppressAjaxErrors = false;
        });
    },

    reloadPageWhenServerAvailable: function (retryCount) {

        var apiClient = window.ApiClient;

        if (!apiClient) {
            return;
        }

        // Don't use apiclient method because we don't want it reporting authentication under the old version
        apiClient.getJSON(apiClient.getUrl("System/Info")).then(function (info) {

            // If this is back to false, the restart completed
            if (!info.HasPendingRestart) {
                window.location.reload(true);
            } else {
                Dashboard.retryReload(retryCount);
            }

        }, function () {
            Dashboard.retryReload(retryCount);
        });
    },

    retryReload: function (retryCount) {
        setTimeout(function () {

            retryCount = retryCount || 0;
            retryCount++;

            if (retryCount < 10) {
                Dashboard.reloadPageWhenServerAvailable(retryCount);
            } else {
                Dashboard.suppressAjaxErrors = false;
            }
        }, 500);
    },

    showUserFlyout: function () {

        Dashboard.navigate('mypreferencesmenu.html');
    },

    getPluginSecurityInfo: function () {

        var apiClient = window.ApiClient;

        if (!apiClient) {

            return Promise.reject();
        }

        var cachedInfo = Dashboard.pluginSecurityInfo;
        if (cachedInfo) {
            return Promise.resolve(cachedInfo);
        }

        return apiClient.ajax({
            type: "GET",
            url: apiClient.getUrl("Plugins/SecurityInfo"),
            dataType: 'json',

            error: function () {
                // Don't show normal dashboard errors
            }

        }).then(function (result) {
            Dashboard.pluginSecurityInfo = result;
            return result;
        });
    },

    resetPluginSecurityInfo: function () {
        Dashboard.pluginSecurityInfo = null;
    },

    ensureHeader: function (page) {

        if (page.classList.contains('standalonePage') && !page.classList.contains('noHeaderPage')) {

            Dashboard.renderHeader(page);
        }
    },

    renderHeader: function (page) {

        var header = page.querySelector('.header');

        if (!header) {
            var headerHtml = '';

            headerHtml += '<div class="header">';

            headerHtml += '<a class="logo" href="home.html" style="text-decoration:none;font-size: 22px;">';

            if (page.classList.contains('standalonePage')) {

                headerHtml += '<img class="imgLogoIcon" src="css/images/logo.png" />';
            }

            headerHtml += '</a>';

            headerHtml += '</div>';
            page.insertAdjacentHTML('afterbegin', headerHtml);
        }
    },

    getToolsLinkHtml: function (item) {

        var menuHtml = '';
        var pageIds = item.pageIds ? item.pageIds.join(',') : '';
        pageIds = pageIds ? (' data-pageids="' + pageIds + '"') : '';
        menuHtml += '<a class="sidebarLink" href="' + item.href + '"' + pageIds + '>';

        var icon = item.icon;

        if (icon) {
            var style = item.color ? ' style="color:' + item.color + '"' : '';

            menuHtml += '<i class="md-icon sidebarLinkIcon"' + style + '>' + icon + '</i>';
        }

        menuHtml += '<span class="sidebarLinkText">';
        menuHtml += item.name;
        menuHtml += '</span>';
        menuHtml += '</a>';
        return menuHtml;
    },

    getToolsMenuHtml: function (page) {

        var items = Dashboard.getToolsMenuLinks(page);

        var i, length, item;
        var menuHtml = '';
        menuHtml += '<div class="drawerContent">';
        for (i = 0, length = items.length; i < length; i++) {

            item = items[i];

            if (item.divider) {
                menuHtml += "<div class='sidebarDivider'></div>";
            }

            if (item.href) {

                menuHtml += Dashboard.getToolsLinkHtml(item);
            } else {

                menuHtml += '<div class="sidebarHeader">';
                menuHtml += item.name;
                menuHtml += '</div>';
            }
        }
        menuHtml += '</div>';

        return menuHtml;
    },

    getToolsMenuLinks: function () {

        return [{
            name: Globalize.translate('TabServer')
        }, {
            name: Globalize.translate('TabDashboard'),
            href: "dashboard.html",
            pageIds: ['dashboardPage'],
            icon: 'dashboard'
        }, {
            name: Globalize.translate('TabSettings'),
            href: "dashboardgeneral.html",
            pageIds: ['dashboardGeneralPage'],
            icon: 'settings'
        }, {
            name: Globalize.translate('TabDevices'),
            href: "devices.html",
            pageIds: ['devicesPage', 'devicePage'],
            icon: 'tablet'
        }, {
            name: Globalize.translate('TabUsers'),
            href: "userprofiles.html",
            pageIds: ['userProfilesPage', 'newUserPage', 'editUserPage', 'userLibraryAccessPage', 'userParentalControlPage', 'userPasswordPage'],
            icon: 'people'
        }, {
            name: 'Emby Premiere',
            href: "supporterkey.html",
            pageIds: ['supporterKeyPage'],
            icon: 'star'
        }, {
            divider: true,
            name: Globalize.translate('TabLibrary'),
            href: "library.html",
            pageIds: ['mediaLibraryPage', 'librarySettingsPage', 'libraryDisplayPage', 'metadataImagesConfigurationPage', 'metadataNfoPage'],
            icon: 'folder',
            color: '#38c'
        }, {
            name: Globalize.translate('TabSubtitles'),
            href: "metadatasubtitles.html",
            pageIds: ['metadataSubtitlesPage'],
            icon: 'closed_caption'
        }, {
            name: Globalize.translate('TabPlayback'),
            icon: 'play_circle_filled',
            color: '#E5342E',
            href: "cinemamodeconfiguration.html",
            pageIds: ['cinemaModeConfigurationPage', 'playbackConfigurationPage', 'streamingSettingsPage']
        }, {
            name: Globalize.translate('TabSync'),
            icon: 'sync',
            href: "syncactivity.html",
            pageIds: ['syncActivityPage', 'syncJobPage', 'devicesUploadPage', 'syncSettingsPage'],
            color: '#009688'
        }, {
            name: Globalize.translate('TabTranscoding'),
            icon: 'transform',
            href: "encodingsettings.html",
            pageIds: ['encodingSettingsPage']
        }, {
            divider: true,
            name: Globalize.translate('TabExtras')
        }, {
            name: Globalize.translate('TabAutoOrganize'),
            color: '#01C0DD',
            href: "autoorganizelog.html",
            pageIds: ['libraryFileOrganizerPage', 'libraryFileOrganizerSmartMatchPage', 'libraryFileOrganizerLogPage'],
            icon: 'folder'
        }, {
            name: Globalize.translate('DLNA'),
            href: "dlnasettings.html",
            pageIds: ['dlnaSettingsPage', 'dlnaProfilesPage', 'dlnaProfilePage'],
            icon: 'settings'
        }, {
            name: Globalize.translate('TabLiveTV'),
            href: "livetvstatus.html",
            pageIds: ['liveTvStatusPage', 'liveTvSettingsPage', 'liveTvTunerProviderHdHomerunPage', 'liveTvTunerProviderM3UPage', 'liveTvTunerProviderSatPage'],
            icon: 'dvr'
        }, {
            name: Globalize.translate('TabNotifications'),
            icon: 'notifications',
            color: 'brown',
            href: "notificationsettings.html",
            pageIds: ['notificationSettingsPage', 'notificationSettingPage']
        }, {
            name: Globalize.translate('TabPlugins'),
            icon: 'add_shopping_cart',
            color: '#9D22B1',
            href: "plugins.html",
            pageIds: ['pluginsPage', 'pluginCatalogPage']
        }, {
            divider: true,
            name: Globalize.translate('TabExpert')
        }, {
            name: Globalize.translate('TabAdvanced'),
            icon: 'settings',
            href: "dashboardhosting.html",
            color: '#F16834',
            pageIds: ['dashboardHostingPage', 'serverSecurityPage']
        }, {
            name: Globalize.translate('TabLogs'),
            href: "log.html",
            pageIds: ['logPage'],
            icon: 'folder_open'
        }, {
            name: Globalize.translate('TabScheduledTasks'),
            href: "scheduledtasks.html",
            pageIds: ['scheduledTasksPage', 'scheduledTaskPage'],
            icon: 'schedule'
        }, {
            name: Globalize.translate('MetadataManager'),
            href: "edititemmetadata.html",
            pageIds: [],
            icon: 'mode_edit'
        }, {
            name: Globalize.translate('ButtonReports'),
            href: "reports.html",
            pageIds: [],
            icon: 'insert_chart'
        }];

    },

    getSupportedRemoteCommands: function () {

        // Full list
        // https://github.com/MediaBrowser/MediaBrowser/blob/master/MediaBrowser.Model/Session/GeneralCommand.cs
        return [
            "GoHome",
            "GoToSettings",
            "VolumeUp",
            "VolumeDown",
            "Mute",
            "Unmute",
            "ToggleMute",
            "SetVolume",
            "SetAudioStreamIndex",
            "SetSubtitleStreamIndex",
            "DisplayContent",
            "GoToSearch",
            "DisplayMessage",
            "SetRepeatMode"
        ];

    },

    capabilities: function () {

        var caps = {
            PlayableMediaTypes: ['Audio', 'Video'],

            SupportedCommands: Dashboard.getSupportedRemoteCommands(),

            // Need to use this rather than AppInfo.isNativeApp because the property isn't set yet at the time we call this
            SupportsPersistentIdentifier: Dashboard.isRunningInCordova(),

            SupportsMediaControl: true,
            SupportedLiveMediaTypes: ['Audio', 'Video']
        };

        if (Dashboard.isRunningInCordova() && !browserInfo.safari) {
            caps.SupportsSync = true;
            caps.SupportsContentUploading = true;
        }

        return caps;
    },

    normalizeImageOptions: function (options) {

        if (AppInfo.hasLowImageBandwidth) {

            options.enableImageEnhancers = false;
        }

        var setQuality;
        if (options.maxWidth) {
            setQuality = true;
        }

        if (options.width) {
            setQuality = true;
        }

        if (options.maxHeight) {
            setQuality = true;
        }

        if (options.height) {
            setQuality = true;
        }

        if (setQuality) {
            var quality = 90;

            var isBackdrop = (options.type || '').toLowerCase() == 'backdrop';
            if (isBackdrop) {
                quality -= 10;
            }

            if (browserInfo.slow) {
                quality -= 40;
            }

            if (AppInfo.hasLowImageBandwidth && !isBackdrop) {

                quality -= 10;
            }
            options.quality = quality;
        }
    }
};

var AppInfo = {};

(function () {
    'use strict';

    function setAppInfo() {

        var isCordova = Dashboard.isRunningInCordova();

        AppInfo.enableHomeTabs = true;
        AppInfo.enableAutoSave = browserInfo.touch;

        AppInfo.enableAppStorePolicy = isCordova;

        var isIOS = browserInfo.ipad || browserInfo.iphone;
        var isAndroid = browserInfo.android;

        if (isIOS) {

            AppInfo.hasLowImageBandwidth = true;
        }

        if (isCordova) {
            AppInfo.isNativeApp = true;
            AppInfo.enableHomeTabs = false;

            if (isAndroid) {
                AppInfo.supportsExternalPlayers = true;
            }
        }
        else {
            AppInfo.enableSupporterMembership = true;
        }

        // This currently isn't working on android, unfortunately
        AppInfo.supportsFileInput = !(AppInfo.isNativeApp && isAndroid);

        if (isCordova && isIOS) {
            AppInfo.moreIcon = 'more-horiz';
        } else {
            AppInfo.moreIcon = 'more-vert';
        }

        AppInfo.supportsUserDisplayLanguageSetting = Dashboard.isConnectMode();
    }

    function initializeApiClient(apiClient) {

        if (AppInfo.enableAppStorePolicy) {
            apiClient.getAvailablePlugins = function () {
                return Promise.resolve([]);
            };
            apiClient.getInstalledPlugins = function () {
                return Promise.resolve([]);
            };
        }

        apiClient.normalizeImageOptions = Dashboard.normalizeImageOptions;

        Events.off(apiClient, 'requestfail', Dashboard.onRequestFail);
        Events.on(apiClient, 'requestfail', Dashboard.onRequestFail);
    }

    function onApiClientCreated(e, newApiClient) {
        initializeApiClient(newApiClient);

        // This is not included in jQuery slim
        if (window.$) {
            $.ajax = newApiClient.ajax;
        }
    }

    function defineConnectionManager(connectionManager) {

        window.ConnectionManager = connectionManager;

        define('connectionManager', [], function () {
            return connectionManager;
        });
    }

    var localApiClient;
    function bindConnectionManagerEvents(connectionManager, events, userSettings) {

        window.Events = events;
        events.on(ConnectionManager, 'apiclientcreated', onApiClientCreated);

        connectionManager.currentApiClient = function () {

            if (!localApiClient) {
                var server = connectionManager.getLastUsedServer();
                if (server) {
                    localApiClient = connectionManager.getApiClient(server.Id);
                }
            }
            return localApiClient;
        };

        //events.on(connectionManager, 'apiclientcreated', function (e, newApiClient) {

        //    //$(newApiClient).on("websocketmessage", Dashboard.onWebSocketMessageReceived).on('requestfail', Dashboard.onRequestFail);
        //    newApiClient.normalizeImageOptions = normalizeImageOptions;
        //});

        // Use this instead of the event because it will fire and wait for the promise before firing events to all listeners
        connectionManager.onLocalUserSignedIn = function (user) {
            localApiClient = connectionManager.getApiClient(user.ServerId);
            window.ApiClient = localApiClient;
            return userSettings.setUserInfo(user.Id, localApiClient);
        };

        events.on(connectionManager, 'localusersignedout', function () {
            userSettings.setUserInfo(null, null);
        });
    }

    //localStorage.clear();
    function createConnectionManager() {

        return new Promise(function (resolve, reject) {

            require(['connectionManagerFactory', 'apphost', 'credentialprovider', 'events', 'userSettings'], function (connectionManagerExports, apphost, credentialProvider, events, userSettings) {

                window.MediaBrowser = Object.assign(window.MediaBrowser || {}, connectionManagerExports);

                var credentialProviderInstance = new credentialProvider();

                var promises = [apphost.getSyncProfile(), apphost.appInfo()];

                Promise.all(promises).then(function (responses) {

                    var deviceProfile = responses[0];
                    var appInfo = responses[1];

                    var capabilities = Dashboard.capabilities();
                    capabilities.DeviceProfile = deviceProfile;

                    var connectionManager = new MediaBrowser.ConnectionManager(credentialProviderInstance, appInfo.appName, appInfo.appVersion, appInfo.deviceName, appInfo.deviceId, capabilities, window.devicePixelRatio);

                    defineConnectionManager(connectionManager);
                    bindConnectionManagerEvents(connectionManager, events, userSettings);

                    if (Dashboard.isConnectMode()) {

                        resolve();

                    } else {

                        console.log('loading ApiClient singleton');

                        return getRequirePromise(['apiclient']).then(function (apiClientFactory) {

                            console.log('creating ApiClient singleton');

                            var apiClient = new apiClientFactory(Dashboard.serverAddress(), appInfo.appName, appInfo.appVersion, appInfo.deviceName, appInfo.deviceId, window.devicePixelRatio);
                            apiClient.enableAutomaticNetworking = false;
                            connectionManager.addApiClient(apiClient);
                            require(['css!' + apiClient.getUrl('Branding/Css')]);
                            window.ApiClient = apiClient;
                            localApiClient = apiClient;
                            console.log('loaded ApiClient singleton');
                            resolve();
                        });
                    }
                });
            });
        });
    }

    function setDocumentClasses(browser) {

        var elem = document.documentElement;

        if (!AppInfo.enableSupporterMembership) {
            elem.classList.add('supporterMembershipDisabled');
        }
    }

    function loadTheme() {

        var name = getParameterByName('theme');
        if (name) {
            require(['themes/' + name + '/theme']);
            return;
        }

        if (AppInfo.isNativeApp) {
            return;
        }

        var date = new Date();
        var month = date.getMonth();
        var day = date.getDate();

        if (month == 9 && day >= 30) {
            require(['themes/halloween/theme']);
            return;
        }

        //if (month == 11 && day >= 20 && day <= 25) {
        //    require(['themes/holiday/theme']);
        //    return;
        //}
    }

    function returnFirstDependency(obj) {
        return obj;
    }

    function getBowerPath() {

        return "bower_components";
    }

    function getLayoutManager(layoutManager) {

        layoutManager.init();
        return layoutManager;
    }

    function getAppStorage(basePath) {

        try {
            localStorage.setItem('_test', '0');
            localStorage.removeItem('_test');
            return basePath + "/appstorage-localstorage";
        } catch (e) {
            return basePath + "/appstorage-memory";
        }
    }

    function createWindowHeadroom() {
        // construct an instance of Headroom, passing the element
        var headroom = new Headroom([], {
            // or scroll tolerance per direction
            tolerance: {
                down: 0,
                up: 0
            },
            classes: {
                //pinned: 'appfooter--pinned',
                //unpinned: 'appfooter--unpinned',
                //initial: 'appfooter-headroom'
            }
        });
        // initialise
        headroom.init();
        return headroom;
    }

    function createMainContentHammer(Hammer) {

        var hammer = new Hammer(document.querySelector('.mainDrawerPanelContent'), null);
        return hammer;
    }

    function createSharedAppFooter(appFooter) {
        var footer = new appFooter({});
        return footer;
    }

    function initRequire() {

        var urlArgs = "v=" + (window.dashboardVersion || new Date().getDate());

        var bowerPath = getBowerPath();

        var apiClientBowerPath = bowerPath + "/emby-apiclient";
        var embyWebComponentsBowerPath = bowerPath + '/emby-webcomponents';

        var paths = {
            velocity: bowerPath + "/velocity/velocity.min",
            vibrant: bowerPath + "/vibrant/dist/vibrant",
            ironCardList: 'components/ironcardlist/ironcardlist',
            scrollThreshold: 'components/scrollthreshold',
            playlisteditor: 'components/playlisteditor/playlisteditor',
            medialibrarycreator: 'components/medialibrarycreator/medialibrarycreator',
            medialibraryeditor: 'components/medialibraryeditor/medialibraryeditor',
            howler: bowerPath + '/howlerjs/howler.min',
            sortable: bowerPath + '/Sortable/Sortable.min',
            isMobile: bowerPath + '/isMobile/isMobile.min',
            headroom: bowerPath + '/headroomjs/dist/headroom',
            masonry: bowerPath + '/masonry/dist/masonry.pkgd.min',
            humanedate: 'components/humanedate',
            libraryBrowser: 'scripts/librarybrowser',
            chromecasthelpers: 'components/chromecasthelpers',
            events: apiClientBowerPath + '/events',
            credentialprovider: apiClientBowerPath + '/credentials',
            apiclient: apiClientBowerPath + '/apiclient',
            connectionManagerFactory: bowerPath + '/emby-apiclient/connectionmanager',
            visibleinviewport: embyWebComponentsBowerPath + "/visibleinviewport",
            browserdeviceprofile: embyWebComponentsBowerPath + "/browserdeviceprofile",
            browser: embyWebComponentsBowerPath + "/browser",
            inputManager: embyWebComponentsBowerPath + "/inputmanager",
            qualityoptions: embyWebComponentsBowerPath + "/qualityoptions",
            hammer: bowerPath + "/hammerjs/hammer.min",
            pageJs: embyWebComponentsBowerPath + '/pagejs/page',
            focusManager: embyWebComponentsBowerPath + "/focusmanager",
            datetime: embyWebComponentsBowerPath + "/datetime",
            globalize: embyWebComponentsBowerPath + "/globalize",
            itemHelper: embyWebComponentsBowerPath + '/itemhelper',
            itemShortcuts: embyWebComponentsBowerPath + "/shortcuts",
            serverNotifications: embyWebComponentsBowerPath + '/servernotifications',
            playbackManager: embyWebComponentsBowerPath + '/playback/playbackmanager',
            nowPlayingHelper: embyWebComponentsBowerPath + '/playback/nowplayinghelper',
            pluginManager: embyWebComponentsBowerPath + '/pluginmanager',
            packageManager: embyWebComponentsBowerPath + '/packagemanager',
            webAnimations: bowerPath + '/web-animations-js/web-animations-next-lite.min'
        };

        paths.hlsjs = bowerPath + "/hlsjs/dist/hls.min";

        define("webActionSheet", [embyWebComponentsBowerPath + "/actionsheet/actionsheet"], returnFirstDependency);

        if (Dashboard.isRunningInCordova()) {
            paths.sharingMenu = "cordova/sharingwidget";
        } else {

            define("sharingMenu", [embyWebComponentsBowerPath + "/sharing/sharingmenu"], returnFirstDependency);
        }

        paths.wakeonlan = apiClientBowerPath + "/wakeonlan";

        define("libjass", [bowerPath + "/libjass/libjass.min", "css!" + bowerPath + "/libjass/libjass"], returnFirstDependency);

        if (window.IntersectionObserver) {
            define("lazyLoader", [embyWebComponentsBowerPath + "/lazyloader/lazyloader-intersectionobserver"], returnFirstDependency);
        } else {
            define("lazyLoader", [embyWebComponentsBowerPath + "/lazyloader/lazyloader-scroll"], returnFirstDependency);
        }
        define("imageLoader", [embyWebComponentsBowerPath + "/images/imagehelper"], returnFirstDependency);
        define("appfooter", ["components/appfooter/appfooter"], returnFirstDependency);
        define("dockedtabs", ["components/dockedtabs/dockedtabs"], returnFirstDependency);
        define("directorybrowser", ["components/directorybrowser/directorybrowser"], returnFirstDependency);
        define("metadataEditor", [embyWebComponentsBowerPath + "/metadataeditor/metadataeditor"], returnFirstDependency);
        define("personEditor", [embyWebComponentsBowerPath + "/metadataeditor/personeditor"], returnFirstDependency);
        define("playerSelectionMenu", [embyWebComponentsBowerPath + "/playback/playerselection"], returnFirstDependency);
        define("playerSettingsMenu", [embyWebComponentsBowerPath + "/playback/playersettingsmenu"], returnFirstDependency);

        define("libraryMenu", ["scripts/librarymenu"], returnFirstDependency);

        define("emby-collapse", [embyWebComponentsBowerPath + "/emby-collapse/emby-collapse"], returnFirstDependency);
        define("emby-button", [embyWebComponentsBowerPath + "/emby-button/emby-button"], returnFirstDependency);
        define("emby-itemscontainer", [embyWebComponentsBowerPath + "/emby-itemscontainer/emby-itemscontainer"], returnFirstDependency);
        define("emby-tabs", [embyWebComponentsBowerPath + "/emby-tabs/emby-tabs"], returnFirstDependency);
        define("itemHoverMenu", [embyWebComponentsBowerPath + "/itemhovermenu/itemhovermenu"], returnFirstDependency);
        define("multiSelect", [embyWebComponentsBowerPath + "/multiselect/multiselect"], returnFirstDependency);
        define("alphaPicker", [embyWebComponentsBowerPath + "/alphapicker/alphapicker"], returnFirstDependency);
        define("paper-icon-button-light", [embyWebComponentsBowerPath + "/emby-button/paper-icon-button-light"]);

        define("connectHelper", [embyWebComponentsBowerPath + "/emby-connect/connecthelper"], returnFirstDependency);

        define("emby-input", [embyWebComponentsBowerPath + "/emby-input/emby-input"], returnFirstDependency);
        define("emby-select", [embyWebComponentsBowerPath + "/emby-select/emby-select"], returnFirstDependency);
        define("emby-slider", [embyWebComponentsBowerPath + "/emby-slider/emby-slider"], returnFirstDependency);
        define("emby-checkbox", [embyWebComponentsBowerPath + "/emby-checkbox/emby-checkbox"], returnFirstDependency);
        define("emby-toggle", [embyWebComponentsBowerPath + "/emby-toggle/emby-toggle"], returnFirstDependency);
        define("emby-radio", [embyWebComponentsBowerPath + "/emby-radio/emby-radio"], returnFirstDependency);
        define("emby-textarea", [embyWebComponentsBowerPath + "/emby-textarea/emby-textarea"], returnFirstDependency);
        define("collectionEditor", [embyWebComponentsBowerPath + "/collectioneditor/collectioneditor"], returnFirstDependency);
        define("playlistEditor", [embyWebComponentsBowerPath + "/playlisteditor/playlisteditor"], returnFirstDependency);
        define("recordingCreator", [embyWebComponentsBowerPath + "/recordingcreator/recordingcreator"], returnFirstDependency);
        define("recordingEditor", [embyWebComponentsBowerPath + "/recordingcreator/recordingeditor"], returnFirstDependency);
        define("seriesRecordingEditor", [embyWebComponentsBowerPath + "/recordingcreator/seriesrecordingeditor"], returnFirstDependency);
        define("recordingFields", [embyWebComponentsBowerPath + "/recordingcreator/recordingfields"], returnFirstDependency);
        define("recordingHelper", [embyWebComponentsBowerPath + "/recordingcreator/recordinghelper"], returnFirstDependency);
        define("subtitleEditor", [embyWebComponentsBowerPath + "/subtitleeditor/subtitleeditor"], returnFirstDependency);
        define("itemIdentifier", [embyWebComponentsBowerPath + "/itemidentifier/itemidentifier"], returnFirstDependency);
        define("mediaInfo", [embyWebComponentsBowerPath + "/mediainfo/mediainfo"], returnFirstDependency);
        define("itemContextMenu", [embyWebComponentsBowerPath + "/itemcontextmenu"], returnFirstDependency);
        define("imageEditor", [embyWebComponentsBowerPath + "/imageeditor/imageeditor"], returnFirstDependency);
        define("dom", [embyWebComponentsBowerPath + "/dom"], returnFirstDependency);

        define("fullscreen-doubleclick", [embyWebComponentsBowerPath + "/fullscreen/fullscreen-doubleclick"], returnFirstDependency);
        define("fullscreenManager", [embyWebComponentsBowerPath + "/fullscreen/fullscreenmanager", 'events'], returnFirstDependency);

        define("layoutManager", [embyWebComponentsBowerPath + "/layoutmanager"], getLayoutManager);
        define("playMenu", [embyWebComponentsBowerPath + "/playmenu"], returnFirstDependency);
        define("refreshDialog", [embyWebComponentsBowerPath + "/refreshdialog/refreshdialog"], returnFirstDependency);
        define("backdrop", [embyWebComponentsBowerPath + "/backdrop/backdrop"], returnFirstDependency);
        define("fetchHelper", [embyWebComponentsBowerPath + "/fetchhelper"], returnFirstDependency);

        define("roundCardStyle", ["cardStyle", 'css!' + embyWebComponentsBowerPath + "/cardbuilder/roundcard"], returnFirstDependency);
        define("cardStyle", ['css!' + embyWebComponentsBowerPath + "/cardbuilder/card"], returnFirstDependency);
        define("cardBuilder", [embyWebComponentsBowerPath + "/cardbuilder/cardbuilder"], returnFirstDependency);
        define("peoplecardbuilder", [embyWebComponentsBowerPath + "/cardbuilder/peoplecardbuilder"], returnFirstDependency);
        define("chaptercardbuilder", [embyWebComponentsBowerPath + "/cardbuilder/chaptercardbuilder"], returnFirstDependency);

        define("mouseManager", [embyWebComponentsBowerPath + "/input/mouse"], returnFirstDependency);

        define("deleteHelper", [embyWebComponentsBowerPath + "/deletehelper"], returnFirstDependency);
        define("tvguide", [embyWebComponentsBowerPath + "/guide/guide"], returnFirstDependency);
        define("programStyles", ['css!' + embyWebComponentsBowerPath + "/guide/programs"], returnFirstDependency);
        define("guide-settings-dialog", [embyWebComponentsBowerPath + "/guide/guide-settings"], returnFirstDependency);
        define("syncDialog", [embyWebComponentsBowerPath + "/sync/sync"], returnFirstDependency);
        define("syncToggle", [embyWebComponentsBowerPath + "/sync/synctoggle"], returnFirstDependency);
        define("syncJobEditor", [embyWebComponentsBowerPath + "/sync/syncjobeditor"], returnFirstDependency);
        define("syncJobList", [embyWebComponentsBowerPath + "/sync/syncjoblist"], returnFirstDependency);
        define("voiceDialog", [embyWebComponentsBowerPath + "/voice/voicedialog"], returnFirstDependency);
        define("voiceReceiver", [embyWebComponentsBowerPath + "/voice/voicereceiver"], returnFirstDependency);
        define("voiceProcessor", [embyWebComponentsBowerPath + "/voice/voiceprocessor"], returnFirstDependency);

        define("viewManager", [embyWebComponentsBowerPath + "/viewmanager/viewmanager"], function (viewManager) {
            window.ViewManager = viewManager;
            viewManager.dispatchPageEvents(true);
            return viewManager;
        });

        // hack for an android test before browserInfo is loaded
        if (Dashboard.isRunningInCordova() && window.MainActivity) {
            define("shell", ["cordova/shell"], returnFirstDependency);
        } else {
            define("shell", [embyWebComponentsBowerPath + "/shell"], returnFirstDependency);
        }

        define("sharingmanager", [embyWebComponentsBowerPath + "/sharing/sharingmanager"], returnFirstDependency);

        if (Dashboard.isRunningInCordova()) {
            paths.apphost = "cordova/apphost";
        } else {
            paths.apphost = "components/apphost";
        }

        // hack for an android test before browserInfo is loaded
        if (Dashboard.isRunningInCordova() && window.MainActivity) {
            paths.appStorage = "cordova/appstorage";
            paths.filesystem = 'cordova/filesystem';
        } else {
            paths.appStorage = getAppStorage(apiClientBowerPath);
            paths.filesystem = embyWebComponentsBowerPath + '/filesystem';
        }

        var sha1Path = bowerPath + "/cryptojslib/components/sha1-min";
        var md5Path = bowerPath + "/cryptojslib/components/md5-min";
        var shim = {};

        shim[sha1Path] = {
            deps: [bowerPath + "/cryptojslib/components/core-min"]
        };

        shim[md5Path] = {
            deps: [bowerPath + "/cryptojslib/components/core-min"]
        };

        requirejs.config({
            waitSeconds: 0,
            map: {
                '*': {
                    'css': bowerPath + '/emby-webcomponents/require/requirecss',
                    'html': bowerPath + '/emby-webcomponents/require/requirehtml',
                    'text': bowerPath + '/emby-webcomponents/require/requiretext'
                }
            },
            urlArgs: urlArgs,

            paths: paths,
            shim: shim
        });

        define("cryptojs-sha1", [sha1Path]);
        define("cryptojs-md5", [md5Path]);

        define("jstree", [bowerPath + "/jstree/dist/jstree", "css!thirdparty/jstree/themes/default/style.min.css"]);

        define("dashboardcss", ['css!css/dashboard']);

        define("jqmtable", ["thirdparty/jquerymobile-1.4.5/jqm.table", 'css!thirdparty/jquerymobile-1.4.5/jqm.table.css']);

        define("jqmwidget", ["thirdparty/jquerymobile-1.4.5/jqm.widget"]);

        define("jqmslider", ["thirdparty/jquerymobile-1.4.5/jqm.slider", 'css!thirdparty/jquerymobile-1.4.5/jqm.slider.css']);

        define("jqmpopup", ["thirdparty/jquerymobile-1.4.5/jqm.popup", 'css!thirdparty/jquerymobile-1.4.5/jqm.popup.css']);

        define("jqmlistview", ['css!thirdparty/jquerymobile-1.4.5/jqm.listview.css']);

        define("jqmpanel", ["thirdparty/jquerymobile-1.4.5/jqm.panel", 'css!thirdparty/jquerymobile-1.4.5/jqm.panel.css']);

        define("slideshow", [embyWebComponentsBowerPath + "/slideshow/slideshow"], returnFirstDependency);

        define('fetch', [bowerPath + '/fetch/fetch']);

        define('raf', [embyWebComponentsBowerPath + '/polyfills/raf']);
        define('functionbind', [embyWebComponentsBowerPath + '/polyfills/bind']);
        define('arraypolyfills', [embyWebComponentsBowerPath + '/polyfills/array']);
        define('objectassign', [embyWebComponentsBowerPath + '/polyfills/objectassign']);

        define("clearButtonStyle", ['css!' + embyWebComponentsBowerPath + '/clearbutton']);
        define("userdataButtons", [embyWebComponentsBowerPath + "/userdatabuttons/userdatabuttons"], returnFirstDependency);
        define("listView", [embyWebComponentsBowerPath + "/listview/listview"], returnFirstDependency);
        define("listViewStyle", ['css!' + embyWebComponentsBowerPath + "/listview/listview"], returnFirstDependency);
        define("formDialogStyle", ['css!' + embyWebComponentsBowerPath + "/formdialog"], returnFirstDependency);
        define("indicators", [embyWebComponentsBowerPath + "/indicators/indicators"], returnFirstDependency);

        define("registrationServices", [embyWebComponentsBowerPath + "/registrationservices/registrationservices"], returnFirstDependency);

        if (Dashboard.isRunningInCordova()) {
            define("iapManager", ["cordova/iap"], returnFirstDependency);
            define("fileupload", ["cordova/fileupload"], returnFirstDependency);
        } else {
            define("iapManager", ["components/iap"], returnFirstDependency);
            define("fileupload", [apiClientBowerPath + "/fileupload"], returnFirstDependency);
        }
        define("connectionmanager", [apiClientBowerPath + "/connectionmanager"]);

        define("cameraRoll", [apiClientBowerPath + "/cameraroll"], returnFirstDependency);
        define("contentuploader", [apiClientBowerPath + "/sync/contentuploader"]);
        define("serversync", [apiClientBowerPath + "/sync/serversync"]);
        define("multiserversync", [apiClientBowerPath + "/sync/multiserversync"]);
        define("offlineusersync", [apiClientBowerPath + "/sync/offlineusersync"]);
        define("mediasync", [apiClientBowerPath + "/sync/mediasync"]);

        define("swiper", [bowerPath + "/Swiper/dist/js/swiper.min", "css!" + bowerPath + "/Swiper/dist/css/swiper.min"], returnFirstDependency);

        define("scroller", [embyWebComponentsBowerPath + "/scroller/smoothscroller"], returnFirstDependency);
        define("toast", [embyWebComponentsBowerPath + "/toast/toast"], returnFirstDependency);
        define("scrollHelper", [embyWebComponentsBowerPath + "/scrollhelper"], returnFirstDependency);

        define("appSettings", [embyWebComponentsBowerPath + "/appsettings"], updateAppSettings);
        define("userSettings", [embyWebComponentsBowerPath + "/usersettings/usersettings"], returnFirstDependency);
        define("userSettingsBuilder", [embyWebComponentsBowerPath + "/usersettings/usersettingsbuilder"], returnFirstDependency);

        define("material-icons", ['css!' + embyWebComponentsBowerPath + '/fonts/material-icons/style']);
        define("robotoFont", ['css!' + embyWebComponentsBowerPath + '/fonts/roboto/style']);
        define("scrollStyles", ['css!' + embyWebComponentsBowerPath + '/scrollstyles']);

        define("navdrawer", ['components/navdrawer/navdrawer'], returnFirstDependency);
        define("viewcontainer", ['components/viewcontainer-lite', 'css!' + embyWebComponentsBowerPath + '/viewmanager/viewcontainer-lite'], returnFirstDependency);
        define('queryString', [bowerPath + '/query-string/index'], function () {
            return queryString;
        });

        define("jQuery", [bowerPath + '/jquery/dist/jquery.slim.min'], function () {

            if (window.ApiClient) {
                jQuery.ajax = ApiClient.ajax;
            }
            return jQuery;
        });

        define("fnchecked", ['legacy/fnchecked']);

        define("dialogHelper", [embyWebComponentsBowerPath + "/dialoghelper/dialoghelper"], function (dialoghelper) {

            dialoghelper.setOnOpen(onDialogOpen);
            return dialoghelper;
        });

        define("inputmanager", ['inputManager'], returnFirstDependency);

        // alias
        define("historyManager", ['embyRouter'], returnFirstDependency);

        define("headroom-window", ['headroom'], createWindowHeadroom);
        define("hammer-main", ['hammer'], createMainContentHammer);
        define("appfooter-shared", ['appfooter'], createSharedAppFooter);

        // mock this for now. not used in this app
        define("skinManager", [], function () {

            return {
                loadUserSkin: function () {

                    Emby.Page.show('/home.html');
                }
            };
        });

        define("connectionManager", [], function () {
            return ConnectionManager;
        });

        define('apiClientResolver', [], function () {
            return function () {
                return window.ApiClient;
            };
        });

        define("embyRouter", [embyWebComponentsBowerPath + '/router'], function (embyRouter) {

            embyRouter.showLocalLogin = function (apiClient, serverId, manualLogin) {
                Dashboard.navigate('login.html?serverid=' + serverId);
            };

            embyRouter.showVideoOsd = function () {
                return Dashboard.navigate('videoosd.html');
            };

            embyRouter.showSelectServer = function () {
                Dashboard.navigate('selectserver.html');
            };

            embyRouter.showWelcome = function () {

                if (Dashboard.isConnectMode()) {
                    Dashboard.navigate('connectlogin.html?mode=welcome');
                } else {
                    Dashboard.navigate('login.html');
                }
            };

            embyRouter.showSettings = function () {
                Dashboard.navigate('mypreferencesmenu.html');
            };

            embyRouter.showGuide = function () {
                Dashboard.navigate('livetv.html?tab=1');
            };

            embyRouter.goHome = function () {
                Dashboard.navigate('home.html');
            };

            embyRouter.showSearch = function () {
                Dashboard.navigate('search.html');
            };

            embyRouter.showLiveTV = function () {
                Dashboard.navigate('livetv.html');
            };

            embyRouter.showRecordedTV = function () {
                Dashboard.navigate('livetv.html?tab=3');
            };

            embyRouter.showFavorites = function () {
                Dashboard.navigate('favorites.html');
            };

            embyRouter.showSettings = function () {
                Dashboard.navigate('mypreferencesmenu.html');
            };

            embyRouter.setTitle = function () {
            };

            function showItem(item, serverId, options) {
                if (typeof (item) === 'string') {
                    require(['connectionManager'], function (connectionManager) {
                        var apiClient = connectionManager.currentApiClient();
                        apiClient.getItem(apiClient.getCurrentUserId(), item).then(function (item) {
                            embyRouter.showItem(item, options);
                        });
                    });
                } else {

                    if (arguments.length == 2) {
                        options = arguments[1];
                    }

                    var context = options ? options.context : null;
                    Emby.Page.show('/' + LibraryBrowser.getHref(item, context), { item: item });
                }
            }

            embyRouter.showItem = showItem;

            return embyRouter;
        });
    }

    function updateAppSettings(appSettings) {

        appSettings.enableExternalPlayers = function (val) {

            if (val != null) {
                appSettings.set('externalplayers', val.toString());
            }

            return appSettings.get('externalplayers') === 'true';
        };

        return appSettings;
    }

    function onDialogOpen(dlg) {
        if (!dlg.classList.contains('background-theme-a') && !dlg.classList.contains('actionSheet')) {

            dlg.classList.add('background-theme-b');
            dlg.classList.add('ui-body-b');
        }
    }

    function initRequireWithBrowser(browser) {

        var bowerPath = getBowerPath();
        var apiClientBowerPath = bowerPath + "/emby-apiclient";
        var embyWebComponentsBowerPath = bowerPath + '/emby-webcomponents';

        if (Dashboard.isRunningInCordova() && browser.safari) {
            define("actionsheet", ["cordova/actionsheet"], returnFirstDependency);
        } else {
            define("actionsheet", ["webActionSheet"], returnFirstDependency);
        }

        if (!('registerElement' in document)) {
            if (browser.msie) {
                define("registerElement", [bowerPath + '/webcomponentsjs/webcomponents-lite.min.js']);
            } else {
                define("registerElement", [bowerPath + '/document-register-element/build/document-register-element']);
            }
        } else {
            define("registerElement", []);
        }

        if ((window.chrome && window.chrome.sockets)) {
            define("serverdiscovery", [apiClientBowerPath + "/serverdiscovery-chrome"], returnFirstDependency);
        } else if (Dashboard.isRunningInCordova() && browser.android) {
            define("serverdiscovery", ["cordova/serverdiscovery"], returnFirstDependency);
        } else if (Dashboard.isRunningInCordova() && browser.safari) {
            define("serverdiscovery", [apiClientBowerPath + "/serverdiscovery-chrome"], returnFirstDependency);
        } else {
            define("serverdiscovery", [apiClientBowerPath + "/serverdiscovery"], returnFirstDependency);
        }

        if (Dashboard.isRunningInCordova() && browser.safari) {
            define("imageFetcher", ['cordova/imagestore'], returnFirstDependency);
        } else {
            define("imageFetcher", [embyWebComponentsBowerPath + "/images/basicimagefetcher"], returnFirstDependency);
        }

        var preferNativeAlerts = browser.tv;
        // use native alerts if preferred and supported (not supported in opera tv)
        if (preferNativeAlerts && window.alert) {
            define("alert", [embyWebComponentsBowerPath + "/alert/nativealert"], returnFirstDependency);
        } else {
            define("alert", [embyWebComponentsBowerPath + "/alert/alert"], returnFirstDependency);
        }

        define("dialog", [embyWebComponentsBowerPath + "/dialog/dialog"], returnFirstDependency);

        if (preferNativeAlerts && window.confirm) {
            define("confirm", [embyWebComponentsBowerPath + "/confirm/nativeconfirm"], returnFirstDependency);
        } else {
            define("confirm", [embyWebComponentsBowerPath + "/confirm/confirm"], returnFirstDependency);
        }

        var preferNativePrompt = preferNativeAlerts || browser.xboxOne;
        if (preferNativePrompt && window.confirm) {
            define("prompt", [embyWebComponentsBowerPath + "/prompt/nativeprompt"], returnFirstDependency);
        } else {
            define("prompt", [embyWebComponentsBowerPath + "/prompt/prompt"], returnFirstDependency);
        }

        if (browser.tizen || browser.operaTv) {
            // Need the older version due to artifacts
            define("loading", [embyWebComponentsBowerPath + "/loading/loading-legacy"], returnFirstDependency);
        } else {
            define("loading", [embyWebComponentsBowerPath + "/loading/loading-lite"], returnFirstDependency);
        }

        define("multi-download", [embyWebComponentsBowerPath + '/multidownload'], returnFirstDependency);

        if (Dashboard.isRunningInCordova() && browser.android) {
            define("fileDownloader", ['cordova/filedownloader'], returnFirstDependency);
            define("localassetmanager", ["cordova/localassetmanager"], returnFirstDependency);
        } else {
            define("fileDownloader", [embyWebComponentsBowerPath + '/filedownloader'], returnFirstDependency);
            define("localassetmanager", [apiClientBowerPath + "/localassetmanager"], returnFirstDependency);
        }

        define("screenLock", [embyWebComponentsBowerPath + "/resourcelocks/nullresourcelock"], returnFirstDependency);

        if (Dashboard.isRunningInCordova() && browser.android) {
            define("resourceLockManager", [embyWebComponentsBowerPath + "/resourcelocks/resourcelockmanager"], returnFirstDependency);
            define("wakeLock", ["cordova/wakelock"], returnFirstDependency);
            define("networkLock", ["cordova/networklock"], returnFirstDependency);
        } else {
            define("resourceLockManager", [embyWebComponentsBowerPath + "/resourcelocks/resourcelockmanager"], returnFirstDependency);
            define("wakeLock", [embyWebComponentsBowerPath + "/resourcelocks/nullresourcelock"], returnFirstDependency);
            define("networkLock", [embyWebComponentsBowerPath + "/resourcelocks/nullresourcelock"], returnFirstDependency);
        }
    }

    function getDummyResourceLockManager() {
        return {
            request: function (resourceType) {
                return Promise.reject();
            }
        };
    }

    function init() {

        if (Dashboard.isRunningInCordova() && browserInfo.android) {
            define("nativedirectorychooser", ["cordova/nativedirectorychooser"]);
        }

        if (Dashboard.isRunningInCordova() && browserInfo.android) {
            define("localsync", ["cordova/localsync"], returnFirstDependency);
        }
        else {
            define("localsync", ["scripts/localsync"], returnFirstDependency);
        }

        define("livetvcss", ['css!css/livetv.css']);
        define("detailtablecss", ['css!css/detailtable.css']);
        define("autoorganizetablecss", ['css!css/autoorganizetable.css']);

        define("buttonenabled", ["legacy/buttonenabled"]);

        initAfterDependencies();
    }

    function getRequirePromise(deps) {

        return new Promise(function (resolve, reject) {

            require(deps, resolve);
        });
    }

    function initAfterDependencies() {

        var list = [];

        if (!window.fetch) {
            list.push('fetch');
        }

        if (typeof Object.assign != 'function') {
            list.push('objectassign');
        }

        if (!Array.prototype.filter) {
            list.push('arraypolyfills');
        }

        if (!Function.prototype.bind) {
            list.push('functionbind');
        }

        if (!window.requestAnimationFrame) {
            list.push('raf');
        }

        require(list, function () {

            createConnectionManager().then(function () {

                console.log('initAfterDependencies promises resolved');

                require(['globalize'], function (globalize) {

                    window.Globalize = globalize;

                    Promise.all([loadCoreDictionary(globalize), loadSharedComponentsDictionary(globalize)]).then(onGlobalizeInit);
                });
            });
        });
    }

    function loadSharedComponentsDictionary(globalize) {

        var baseUrl = 'bower_components/emby-webcomponents/strings/';

        var languages = ['ar', 'bg-bg', 'ca', 'cs', 'da', 'de', 'el', 'en-gb', 'en-us', 'es-ar', 'es-mx', 'es', 'fi', 'fr', 'gsw', 'he', 'hr', 'hu', 'id', 'it', 'kk', 'ko', 'ms', 'nb', 'nl', 'pl', 'pt-br', 'pt-pt', 'ro', 'ru', 'sk', 'sl-si', 'sv', 'tr', 'uk', 'vi', 'zh-cn', 'zh-hk', 'zh-tw'];

        var translations = languages.map(function (i) {
            return {
                lang: i,
                path: baseUrl + i + '.json'
            };
        });

        globalize.loadStrings({
            name: 'sharedcomponents',
            translations: translations
        });
    }

    function loadCoreDictionary(globalize) {

        var baseUrl = 'strings/';

        var languages = ['ar', 'bg-bg', 'ca', 'cs', 'da', 'de', 'el', 'en-gb', 'en-us', 'es-ar', 'es-mx', 'es', 'fi', 'fr', 'gsw', 'he', 'hr', 'hu', 'id', 'it', 'kk', 'ko', 'ms', 'nb', 'nl', 'pl', 'pt-br', 'pt-pt', 'ro', 'ru', 'sl-si', 'sv', 'tr', 'uk', 'vi', 'zh-cn', 'zh-hk', 'zh-tw'];

        var translations = languages.map(function (i) {
            return {
                lang: i,
                path: baseUrl + i + '.json'
            };
        });

        globalize.defaultModule('core');

        return globalize.loadStrings({
            name: 'core',
            translations: translations
        });
    }

    function onGlobalizeInit() {

        document.title = Globalize.translateDocument(document.title, 'core');

        require(['apphost'], function (appHost) {

            loadPlugins([], appHost, browserInfo).then(onAppReady);
        });
    }

    function defineRoute(newRoute, dictionary) {

        var baseRoute = Emby.Page.baseUrl();

        var path = newRoute.path;

        path = path.replace(baseRoute, '');

        console.log('Defining route: ' + path);

        newRoute.dictionary = newRoute.dictionary || dictionary || 'core';
        Emby.Page.addRoute(path, newRoute);
    }

    function defineCoreRoutes() {

        console.log('Defining core routes');

        defineRoute({
            path: '/addplugin.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin',
            controller: 'scripts/addpluginpage'
        });

        defineRoute({
            path: '/appservices.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/autoorganizelog.html',
            dependencies: ['scripts/taskbutton', 'autoorganizetablecss'],
            controller: 'dashboard/autoorganizelog',
            roles: 'admin'
        });

        defineRoute({
            path: '/autoorganizesmart.html',
            dependencies: ['emby-button'],
            controller: 'dashboard/autoorganizesmart',
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/autoorganizetv.html',
            dependencies: ['emby-checkbox', 'emby-input', 'emby-button', 'emby-select', 'emby-collapse'],
            controller: 'dashboard/autoorganizetv',
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/channelitems.html',
            dependencies: [],
            autoFocus: false,
            transition: 'fade'
        });

        defineRoute({
            path: '/channels.html',
            dependencies: [],
            autoFocus: false,
            transition: 'fade',
            controller: 'scripts/channels'
        });

        defineRoute({
            path: '/channelsettings.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/cinemamodeconfiguration.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/connectlogin.html',
            dependencies: ['emby-button', 'emby-input'],
            autoFocus: false,
            anonymous: true,
            startup: true,
            controller: 'scripts/connectlogin'
        });

        defineRoute({
            path: '/dashboard.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/dashboardgeneral.html',
            controller: 'dashboard/dashboardgeneral',
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/dashboardhosting.html',
            dependencies: ['emby-input', 'emby-button'],
            autoFocus: false,
            roles: 'admin',
            controller: 'dashboard/dashboardhosting'
        });

        defineRoute({
            path: '/device.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/devices.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/devicesupload.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/dlnaprofile.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/dlnaprofiles.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/dlnaserversettings.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/dlnasettings.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/edititemmetadata.html',
            dependencies: [],
            controller: 'scripts/edititemmetadata',
            autoFocus: false
        });

        defineRoute({
            path: '/encodingsettings.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/favorites.html',
            dependencies: [],
            autoFocus: false,
            controller: 'scripts/favorites'
        });

        defineRoute({
            path: '/forgotpassword.html',
            dependencies: ['emby-input', 'emby-button'],
            anonymous: true,
            startup: true,
            controller: 'scripts/forgotpassword'
        });

        defineRoute({
            path: '/forgotpasswordpin.html',
            dependencies: ['emby-input', 'emby-button'],
            autoFocus: false,
            anonymous: true,
            startup: true,
            controller: 'scripts/forgotpasswordpin'
        });

        defineRoute({
            path: '/gamegenres.html',
            dependencies: [],
            autoFocus: false
        });

        defineRoute({
            path: '/games.html',
            dependencies: [],
            autoFocus: false
        });

        defineRoute({
            path: '/gamesrecommended.html',
            dependencies: [],
            autoFocus: false
        });

        defineRoute({
            path: '/gamestudios.html',
            dependencies: [],
            autoFocus: false
        });

        defineRoute({
            path: '/gamesystems.html',
            dependencies: [],
            autoFocus: false
        });

        defineRoute({
            path: '/home.html',
            dependencies: [],
            autoFocus: false,
            controller: 'scripts/indexpage',
            transition: 'fade',
            type: 'home'
        });

        defineRoute({
            path: '/index.html',
            dependencies: [],
            autoFocus: false,
            isDefaultRoute: true
        });

        defineRoute({
            path: '/itemdetails.html',
            dependencies: ['emby-button', 'scripts/livetvcomponents', 'paper-icon-button-light', 'emby-itemscontainer'],
            controller: 'scripts/itemdetailpage',
            autoFocus: false,
            transition: 'fade'
        });

        defineRoute({
            path: '/itemlist.html',
            dependencies: [],
            autoFocus: false,
            controller: 'scripts/itemlistpage',
            transition: 'fade'
        });

        defineRoute({
            path: '/kids.html',
            dependencies: [],
            autoFocus: false
        });

        defineRoute({
            path: '/library.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/librarydisplay.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin',
            controller: 'dashboard/librarydisplay'
        });

        defineRoute({
            path: '/librarysettings.html',
            dependencies: ['emby-collapse', 'emby-input', 'emby-button', 'emby-select'],
            autoFocus: false,
            roles: 'admin',
            controller: 'dashboard/librarysettings'
        });

        defineRoute({
            path: '/livetv.html',
            dependencies: ['emby-button', 'livetvcss'],
            controller: 'scripts/livetvsuggested',
            autoFocus: false,
            transition: 'fade'
        });

        defineRoute({
            path: '/livetvguideprovider.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/livetvitems.html',
            dependencies: [],
            autoFocus: false,
            controller: 'scripts/livetvitems'
        });

        defineRoute({
            path: '/livetvseriestimer.html',
            dependencies: ['emby-checkbox', 'emby-input', 'emby-button', 'emby-collapse', 'scripts/livetvcomponents', 'scripts/livetvseriestimer', 'livetvcss'],
            autoFocus: false,
            controller: 'scripts/livetvseriestimer'
        });

        defineRoute({
            path: '/livetvsettings.html',
            dependencies: [],
            autoFocus: false
        });

        defineRoute({
            path: '/livetvstatus.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/livetvtunerprovider-hdhomerun.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/livetvtunerprovider-m3u.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/livetvtunerprovider-satip.html',
            dependencies: ['emby-input'],
            autoFocus: false,
            roles: 'admin',
            controller: 'dashboard/livetvtunerprovider-satip'
        });

        defineRoute({
            path: '/log.html',
            dependencies: ['emby-checkbox'],
            roles: 'admin',
            controller: 'dashboard/logpage'
        });

        defineRoute({
            path: '/login.html',
            dependencies: ['emby-button', 'emby-input'],
            autoFocus: false,
            anonymous: true,
            startup: true,
            controller: 'scripts/loginpage'
        });

        defineRoute({
            path: '/metadataadvanced.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/metadataimages.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/metadatanfo.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/metadatasubtitles.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/movies.html',
            dependencies: ['emby-button'],
            autoFocus: false,
            controller: 'scripts/moviesrecommended',
            transition: 'fade'
        });

        defineRoute({
            path: '/music.html',
            dependencies: [],
            controller: 'scripts/musicrecommended',
            autoFocus: false,
            transition: 'fade'
        });

        defineRoute({
            path: '/mypreferencesdisplay.html',
            dependencies: ['emby-checkbox', 'emby-button', 'emby-select'],
            autoFocus: false,
            transition: 'fade',
            controller: 'scripts/mypreferencesdisplay'
        });

        defineRoute({
            path: '/mypreferenceshome.html',
            dependencies: ['emby-checkbox', 'emby-button', 'emby-select'],
            autoFocus: false,
            transition: 'fade',
            controller: 'scripts/mypreferenceshome'
        });

        defineRoute({
            path: '/mypreferenceslanguages.html',
            dependencies: ['emby-button', 'emby-checkbox', 'emby-select'],
            autoFocus: false,
            transition: 'fade',
            controller: 'scripts/mypreferenceslanguages'
        });

        defineRoute({
            path: '/mypreferencesmenu.html',
            dependencies: ['emby-button'],
            autoFocus: false,
            transition: 'fade',
            controller: 'scripts/mypreferencescommon'
        });

        defineRoute({
            path: '/myprofile.html',
            dependencies: ['emby-button', 'emby-collapse', 'emby-checkbox', 'emby-input'],
            autoFocus: false,
            transition: 'fade',
            controller: 'scripts/myprofile'
        });

        defineRoute({
            path: '/mysync.html',
            dependencies: [],
            autoFocus: false,
            transition: 'fade',
            controller: 'scripts/mysync'
        });

        defineRoute({
            path: '/camerauploadsettings.html',
            dependencies: [],
            autoFocus: false,
            transition: 'fade',
            controller: 'scripts/camerauploadsettings'
        });

        defineRoute({
            path: '/mysyncjob.html',
            dependencies: [],
            autoFocus: false,
            transition: 'fade',
            controller: 'scripts/syncjob'
        });

        defineRoute({
            path: '/mysyncsettings.html',
            dependencies: ['emby-checkbox', 'emby-input', 'emby-button', 'paper-icon-button-light'],
            autoFocus: false,
            transition: 'fade',
            controller: 'scripts/mysyncsettings'
        });

        defineRoute({
            path: '/notificationlist.html',
            dependencies: [],
            autoFocus: false
        });

        defineRoute({
            path: '/notificationsetting.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/notificationsettings.html',
            controller: 'scripts/notificationsettings',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/nowplaying.html',
            dependencies: ['paper-icon-button-light', 'emby-slider', 'emby-button', 'emby-input', 'emby-itemscontainer'],
            controller: 'scripts/nowplayingpage',
            autoFocus: false,
            transition: 'fade',
            fullscreen: true,
            supportsThemeMedia: true
        });

        defineRoute({
            path: '/photos.html',
            dependencies: [],
            autoFocus: false,
            transition: 'fade'
        });

        defineRoute({
            path: '/playbackconfiguration.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/playlists.html',
            dependencies: [],
            autoFocus: false,
            transition: 'fade',
            controller: 'scripts/playlists'
        });

        defineRoute({
            path: '/plugincatalog.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/plugins.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/reports.html',
            dependencies: [],
            autoFocus: false
        });

        defineRoute({
            path: '/scheduledtask.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/scheduledtasks.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/search.html',
            dependencies: [],
            controller: 'scripts/searchpage'
        });

        defineRoute({
            path: '/secondaryitems.html',
            dependencies: [],
            autoFocus: false,
            controller: 'scripts/secondaryitems'
        });

        defineRoute({
            path: '/selectserver.html',
            dependencies: ['listViewStyle', 'emby-button'],
            autoFocus: false,
            anonymous: true,
            startup: true,
            controller: 'scripts/selectserver'
        });

        defineRoute({
            path: '/serversecurity.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/shared.html',
            dependencies: [],
            autoFocus: false,
            anonymous: true
        });

        defineRoute({
            path: '/streamingsettings.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/support.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/supporterkey.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/syncactivity.html',
            dependencies: [],
            autoFocus: false,
            controller: 'scripts/syncactivity'
        });

        defineRoute({
            path: '/syncsettings.html',
            dependencies: [],
            autoFocus: false
        });

        defineRoute({
            path: '/tv.html',
            dependencies: ['paper-icon-button-light', 'emby-button'],
            autoFocus: false,
            controller: 'scripts/tvrecommended',
            transition: 'fade'
        });

        defineRoute({
            path: '/useredit.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/userlibraryaccess.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/usernew.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/userparentalcontrol.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/userpassword.html',
            dependencies: ['emby-input', 'emby-button', 'emby-checkbox'],
            autoFocus: false,
            controller: 'scripts/userpasswordpage'
        });

        defineRoute({
            path: '/userprofiles.html',
            dependencies: [],
            autoFocus: false,
            roles: 'admin'
        });

        defineRoute({
            path: '/wizardagreement.html',
            dependencies: ['dashboardcss'],
            autoFocus: false,
            anonymous: true
        });

        defineRoute({
            path: '/wizardcomponents.html',
            dependencies: ['dashboardcss', 'emby-button', 'emby-input', 'emby-select'],
            autoFocus: false,
            anonymous: true,
            controller: 'dashboard/wizardcomponents'
        });

        defineRoute({
            path: '/wizardfinish.html',
            dependencies: ['emby-button', 'dashboardcss'],
            autoFocus: false,
            anonymous: true,
            controller: 'dashboard/wizardfinishpage'
        });

        defineRoute({
            path: '/wizardlibrary.html',
            dependencies: ['dashboardcss'],
            autoFocus: false,
            anonymous: true
        });

        defineRoute({
            path: '/wizardlivetvguide.html',
            dependencies: ['dashboardcss'],
            autoFocus: false,
            anonymous: true
        });

        defineRoute({
            path: '/wizardlivetvtuner.html',
            dependencies: ['dashboardcss'],
            autoFocus: false,
            anonymous: true
        });

        defineRoute({
            path: '/wizardsettings.html',
            dependencies: ['dashboardcss'],
            autoFocus: false,
            anonymous: true
        });

        defineRoute({
            path: '/wizardstart.html',
            dependencies: ['dashboardcss'],
            autoFocus: false,
            anonymous: true
        });

        defineRoute({
            path: '/wizarduser.html',
            dependencies: ['dashboardcss', 'emby-input'],
            autoFocus: false,
            anonymous: true
        });

        defineRoute({
            path: '/videoosd.html',
            dependencies: [],
            transition: 'fade',
            controller: 'scripts/videoosd',
            autoFocus: false,
            type: 'video-osd',
            supportsThemeMedia: true,
            fullscreen: true
        });

        defineRoute({
            path: '/configurationpage',
            dependencies: ['jQuery'],
            autoFocus: false,
            enableCache: false,
            enableContentQueryString: true,
            roles: 'admin'
        });

        defineRoute({
            path: '/',
            isDefaultRoute: true,
            autoFocus: false,
            dependencies: []
        });
    }

    function loadPlugins(externalPlugins, appHost, browser, shell) {

        console.log('Loading installed plugins');

        // Load installed plugins

        var list = [
        //'plugins/defaultskin/plugin',
        //'plugins/logoscreensaver/plugin',
        //'plugins/backdropscreensaver/plugin',
        //'plugins/defaultsoundeffects/plugin',
        'bower_components/emby-webcomponents/playback/playbackvalidation'
        ];

        if (Dashboard.isRunningInCordova() && browser.android) {

            // use the html audio player if flac is supported
            if (document.createElement('audio').canPlayType('audio/flac').replace(/no/, '') &&
                document.createElement('audio').canPlayType('audio/ogg; codecs="opus"').replace(/no/, '')) {

            } else {
                window.VlcAudio = true;
            }

            // Needed for video
            list.push('cordova/vlcplayer');

        } else if (Dashboard.isRunningInCordova() && browser.safari) {
            list.push('cordova/audioplayer');
        }

        list.push('bower_components/emby-webcomponents/htmlaudioplayer/plugin');

        if (Dashboard.isRunningInCordova() && browser.safari) {
            list.push('cordova/chromecast');
        }

        if (Dashboard.isRunningInCordova() && browser.android) {
            // intent player
            list.push('cordova/externalplayer');
        }

        list.push('bower_components/emby-webcomponents/htmlvideoplayer/plugin');

        if (appHost.supports('remotecontrol')) {
            list.push('bower_components/emby-webcomponents/sessionplayer');

            if (browser.chrome) {
                list.push('bower_components/emby-webcomponents/chromecastplayer');
            }
        }

        list.push('bower_components/emby-webcomponents/youtubeplayer/plugin');

        //if (globalScope.webapis && webapis.avplay) {
        //    list.push('plugins/tizenavplayer/plugin');
        //} else {
        //    list.push('plugins/htmlvideoplayer/plugin');
        //}

        //if (!browser.tv) {
        //    list.push('plugins/confirmstillplaying/plugin');
        //}

        //if (!browser.keyboard) {
        //    list.push('plugins/keyboard/plugin');
        //}

        for (var i = 0, length = externalPlugins.length; i < length; i++) {
            list.push(externalPlugins[i]);
        }

        //if (shell.canExec) {
        //    list.push('plugins/externalplayer/plugin');
        //}

        return new Promise(function (resolve, reject) {

            Promise.all(list.map(loadPlugin)).then(function () {

                require(['packageManager'], function (packageManager) {
                    packageManager.init().then(resolve, reject);
                });

            }, reject);
        });
    }

    function loadPlugin(url) {

        return new Promise(function (resolve, reject) {

            require(['pluginManager'], function (pluginManager) {
                pluginManager.loadPlugin(url).then(resolve, reject);
            });
        });
    }

    function enableNativeGamepadKeyMapping() {

        // On Windows UWP, this will tell the platform to make the gamepad emit normal keyboard events
        if (window.navigator && typeof window.navigator.gamepadInputEmulation === "string") {
            // We want the gamepad to provide gamepad VK keyboard events rather than moving a
            // mouse like cursor. Set to "keyboard", the gamepad will provide such keyboard events
            // and provide input to the DOM navigator.getGamepads API.
            window.navigator.gamepadInputEmulation = "keyboard";
            return true;
        }

        return false;
    }

    function isGamepadSupported() {
        return 'ongamepadconnected' in window || navigator.getGamepads || navigator.webkitGetGamepads;
    }

    function onAppReady() {

        console.log('Begin onAppReady');

        var deps = [];

        deps.push('apphost');
        deps.push('embyRouter');

        if (!(AppInfo.isNativeApp && browserInfo.android)) {
            document.documentElement.classList.add('minimumSizeTabs');
        }

        // Do these now to prevent a flash of content
        if (AppInfo.isNativeApp && browserInfo.android) {
            deps.push('css!devices/android/android.css');
        } else if (AppInfo.isNativeApp && browserInfo.safari) {
            deps.push('css!devices/ios/ios.css');
        }

        loadTheme();

        if (Dashboard.isRunningInCordova()) {
            deps.push('registrationServices');

            if (browserInfo.android) {
                deps.push('cordova/androidcredentials');
            }
        }

        deps.push('libraryMenu');

        console.log('onAppReady - loading dependencies');

        require(deps, function (appHost, pageObjects) {

            console.log('Loaded dependencies in onAppReady');

            window.Emby = {};
            window.Emby.Page = pageObjects;
            defineCoreRoutes();
            Emby.Page.start({
                click: true,
                hashbang: Dashboard.isRunningInCordova()
            });

            var postInitDependencies = [];

            if (!enableNativeGamepadKeyMapping() && isGamepadSupported()) {
                postInitDependencies.push('bower_components/emby-webcomponents/input/gamepadtokey');
            }

            postInitDependencies.push('bower_components/emby-webcomponents/thememediaplayer');
            postInitDependencies.push('css!css/chromecast.css');
            postInitDependencies.push('scripts/autobackdrops');

            if (Dashboard.isRunningInCordova()) {

                if (browserInfo.android) {
                    postInitDependencies.push('cordova/mediasession');
                    postInitDependencies.push('cordova/chromecast');

                } else if (browserInfo.safari) {

                    postInitDependencies.push('cordova/volume');
                    postInitDependencies.push('cordova/statusbar');
                    postInitDependencies.push('cordova/orientation');
                    postInitDependencies.push('cordova/remotecontrols');

                    //postInitDependencies.push('cordova/backgroundfetch');
                }
            }

            postInitDependencies.push('scripts/nowplayingbar');

            postInitDependencies.push('bower_components/emby-webcomponents/playback/remotecontrolautoplay');

            // Prefer custom font over Segoe if on desktop windows
            if (!browserInfo.mobile && navigator.userAgent.toLowerCase().indexOf('windows') != -1) {
                //postInitDependencies.push('opensansFont');
                postInitDependencies.push('robotoFont');
            }

            postInitDependencies.push('bower_components/emby-webcomponents/input/api');
            postInitDependencies.push('mouseManager');

            if (!browserInfo.tv) {

                registerServiceWorker();
                if (window.Notification) {
                    postInitDependencies.push('bower_components/emby-webcomponents/notifications/notifications');
                }
            }

            postInitDependencies.push('playerSelectionMenu');

            if (appHost.supports('fullscreenchange')) {
                require(['fullscreen-doubleclick']);
            }

            require(postInitDependencies);
            initAutoSync();
        });
    }

    function registerServiceWorker() {

        if (navigator.serviceWorker) {
            try {
                navigator.serviceWorker.register('serviceworker.js').then(function () {
                    return navigator.serviceWorker.ready;
                }).then(function (reg) {

                    if (reg && reg.sync) {
                        // https://github.com/WICG/BackgroundSync/blob/master/explainer.md
                        return reg.sync.register('emby-sync').then(function () {
                            window.SyncRegistered = Dashboard.isConnectMode();
                        });
                    }
                });

            } catch (err) {
                console.log('Error registering serviceWorker: ' + err);
            }
        }
    }

    function initAutoSync() {
        require(['serverNotifications', 'events'], function (serverNotifications, events) {
            events.on(serverNotifications, 'SyncJobItemReady', function (e, apiClient, data) {
                require(['localsync'], function (localSync) {
                    localSync.sync({});
                });
            });
        });
    }

    initRequire();

    function onWebComponentsReady(browser) {

        var initialDependencies = [];

        if (!window.Promise || browser.web0s) {
            initialDependencies.push('bower_components/emby-webcomponents/native-promise-only/lib/npo.src');
        }

        initRequireWithBrowser(browser);

        window.browserInfo = browser;
        setAppInfo();
        setDocumentClasses(browser);

        require(initialDependencies, init);
    }

    require(['browser'], onWebComponentsReady);
})();

function pageClassOn(eventName, className, fn) {
    'use strict';

    document.addEventListener(eventName, function (e) {

        var target = e.target;
        if (target.classList.contains(className)) {
            fn.call(target, e);
        }
    });
}

function pageIdOn(eventName, id, fn) {
    'use strict';

    document.addEventListener(eventName, function (e) {

        var target = e.target;
        if (target.id == id) {
            fn.call(target, e);
        }
    });
}

pageClassOn('viewinit', "page", function () {
    'use strict';

    var page = this;

    var current = page.getAttribute('data-theme');

    if (!current) {

        var newTheme;

        if (page.classList.contains('libraryPage')) {
            newTheme = 'b';
        } else {
            newTheme = 'a';
        }

        page.setAttribute("data-theme", newTheme);
        current = newTheme;
    }

    page.classList.add("ui-page");
    page.classList.add("ui-page-theme-" + current);
    page.classList.add("ui-body-" + current);

    var contents = page.querySelectorAll("div[data-role='content']");

    for (var i = 0, length = contents.length; i < length; i++) {
        var content = contents[i];
        //var theme = content.getAttribute("theme") || undefined;

        //content.classList.add("ui-content");
        //if (self.options.contentTheme) {
        //    content.classList.add("ui-body-" + (self.options.contentTheme));
        //}
        // Add ARIA role
        content.setAttribute("role", "main");
        content.classList.add("ui-content");
    }
});

pageClassOn('viewshow', "page", function () {
    'use strict';

    var page = this;

    var currentTheme = page.classList.contains('ui-page-theme-a') ? 'a' : 'b';
    var docElem = document.documentElement;

    if (currentTheme == 'a') {
        docElem.classList.add('background-theme-a');
        docElem.classList.remove('background-theme-b');
    } else {
        docElem.classList.add('background-theme-b');
        docElem.classList.remove('background-theme-a');
    }

    Dashboard.ensureHeader(page);
});