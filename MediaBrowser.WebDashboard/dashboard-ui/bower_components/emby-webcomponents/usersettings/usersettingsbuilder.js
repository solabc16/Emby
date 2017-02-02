define(['appSettings', 'events', 'browser'], function (appsettings, events, browser) {
    'use strict';

    return function () {

        var self = this;
        var currentUserId;
        var currentApiClient;
        var displayPrefs;
        var saveTimeout;

        self.setUserInfo = function (userId, apiClient) {

            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }

            currentUserId = userId;
            currentApiClient = apiClient;

            if (!userId) {
                displayPrefs = null;
                return Promise.resolve();
            }

            return apiClient.getDisplayPreferences('usersettings', userId, 'emby').then(function (result) {
                result.CustomPrefs = result.CustomPrefs || {};
                displayPrefs = result;
            });
        };

        function onSaveTimeout() {
            saveTimeout = null;
            currentApiClient.updateDisplayPreferences('usersettings', displayPrefs, currentUserId, 'emby');
        }
        function saveServerPreferences() {
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
            saveTimeout = setTimeout(onSaveTimeout, 50);
        }

        self.getData = function () {
            return displayPrefs;
        };

        self.importFrom = function (instance) {
            displayPrefs = instance.getData();
        };

        self.set = function (name, value, enableOnServer) {

            var userId = currentUserId;
            if (!userId) {
                throw new Error('userId cannot be null');
            }

            var currentValue = self.get(name);
            appsettings.set(name, value, userId);

            if (enableOnServer !== false && displayPrefs) {
                displayPrefs.CustomPrefs[name] = value == null ? value : value.toString();
                saveServerPreferences();
            }

            if (currentValue !== value) {
                events.trigger(self, 'change', [name]);
            }
        };

        self.get = function (name, enableOnServer) {
            var userId = currentUserId;
            if (!userId) {
                throw new Error('userId cannot be null');
            }

            if (enableOnServer !== false) {
                if (displayPrefs) {
                    return displayPrefs.CustomPrefs[name];
                }
            }

            return appsettings.get(name, userId);
        };

        self.enableCinemaMode = function (val) {

            if (val != null) {
                self.set('enableCinemaMode', val.toString(), false);
            }

            val = self.get('enableCinemaMode', false);

            if (val) {
                return val !== 'false';
            }

            return true;
        };

        self.enableThemeSongs = function (val) {

            if (val != null) {
                self.set('enableThemeSongs', val.toString(), false);
            }

            val = self.get('enableThemeSongs', false);

            return val !== 'false';
        };

        self.enableThemeVideos = function (val) {

            if (val != null) {
                self.set('enableThemeVideos', val.toString(), false);
            }

            val = self.get('enableThemeVideos', false);

            if (val) {
                return val !== 'false';
            }

            return !browser.slow;
        };

        self.language = function (val) {

            if (val != null) {
                self.set('language', val.toString(), false);
            }

            return self.get('language', false);
        };

        self.skipBackLength = function (val) {

            if (val != null) {
                self.set('skipBackLength', val.toString());
            }

            return parseInt(self.get('skipBackLength') || '15000');
        };

        self.skipForwardLength = function (val) {

            if (val != null) {
                self.set('skipForwardLength', val.toString());
            }

            return parseInt(self.get('skipForwardLength') || '15000');
        };

        self.serverConfig = function (config) {

            var apiClient = currentApiClient;

            if (config) {

                return apiClient.updateUserConfiguration(currentUserId, config);

            } else {

                return apiClient.getUser(currentUserId).then(function (user) {

                    return user.Configuration;
                });
            }
        };
    };
});