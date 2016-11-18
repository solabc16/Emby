﻿define(['jQuery', 'fnchecked', 'emby-checkbox'], function ($) {

    function loadPage(page, config) {

        if (config.MergeMetadataAndImagesByName) {
            $('.fldImagesByName', page).hide();
        } else {
            $('.fldImagesByName', page).show();
        }

        $('#txtSeasonZeroName', page).val(config.SeasonZeroDisplayName);

        $('#chkSaveMetadataHidden', page).checked(config.SaveMetadataHidden);

        $('#txtMetadataPath', page).val(config.MetadataPath || '');
        $('#txtMetadataNetworkPath', page).val(config.MetadataNetworkPath || '');

        $('#chkPeopleActors', page).checked(config.PeopleMetadataOptions.DownloadActorMetadata);
        $('#chkPeopleComposers', page).checked(config.PeopleMetadataOptions.DownloadComposerMetadata);
        $('#chkPeopleDirectors', page).checked(config.PeopleMetadataOptions.DownloadDirectorMetadata);
        $('#chkPeopleProducers', page).checked(config.PeopleMetadataOptions.DownloadProducerMetadata);
        $('#chkPeopleWriters', page).checked(config.PeopleMetadataOptions.DownloadWriterMetadata);
        $('#chkPeopleOthers', page).checked(config.PeopleMetadataOptions.DownloadOtherPeopleMetadata);
        $('#chkPeopleGuestStars', page).checked(config.PeopleMetadataOptions.DownloadGuestStarMetadata);

        Dashboard.hideLoadingMsg();
    }

    function loadMetadataConfig(page, config) {

        $('#selectDateAdded', page).val((config.UseFileCreationTimeForDateAdded ? '1' : '0'));
    }

    function loadFanartConfig(page, config) {

        $('#txtFanartApiKey', page).val(config.UserApiKey || '');
    }

    function saveFanart(form) {

        ApiClient.getNamedConfiguration("fanart").then(function (config) {

            config.UserApiKey = $('#txtFanartApiKey', form).val();

            ApiClient.updateNamedConfiguration("fanart", config);
        });
    }

    function saveMetadata(form) {

        ApiClient.getNamedConfiguration("metadata").then(function (config) {

            config.UseFileCreationTimeForDateAdded = $('#selectDateAdded', form).val() == '1';

            ApiClient.updateNamedConfiguration("metadata", config);
        });
    }

    function onSubmit() {
        Dashboard.showLoadingMsg();

        var form = this;

        ApiClient.getServerConfiguration().then(function (config) {

            config.SeasonZeroDisplayName = $('#txtSeasonZeroName', form).val();

            config.SaveMetadataHidden = $('#chkSaveMetadataHidden', form).checked();

            config.EnableTvDbUpdates = $('#chkEnableTvdbUpdates', form).checked();
            config.EnableTmdbUpdates = $('#chkEnableTmdbUpdates', form).checked();
            config.EnableFanArtUpdates = $('#chkEnableFanartUpdates', form).checked();
            config.MetadataPath = $('#txtMetadataPath', form).val();
            config.MetadataNetworkPath = $('#txtMetadataNetworkPath', form).val();
            config.FanartApiKey = $('#txtFanartApiKey', form).val();

            config.PeopleMetadataOptions.DownloadActorMetadata = $('#chkPeopleActors', form).checked();
            config.PeopleMetadataOptions.DownloadComposerMetadata = $('#chkPeopleComposers', form).checked();
            config.PeopleMetadataOptions.DownloadDirectorMetadata = $('#chkPeopleDirectors', form).checked();
            config.PeopleMetadataOptions.DownloadGuestStarMetadata = $('#chkPeopleGuestStars', form).checked();
            config.PeopleMetadataOptions.DownloadProducerMetadata = $('#chkPeopleProducers', form).checked();
            config.PeopleMetadataOptions.DownloadWriterMetadata = $('#chkPeopleWriters', form).checked();
            config.PeopleMetadataOptions.DownloadOtherPeopleMetadata = $('#chkPeopleOthers', form).checked();

            ApiClient.updateServerConfiguration(config).then(Dashboard.processServerConfigurationUpdateResult);
        });

        saveMetadata(form);
        saveFanart(form);

        // Disable default form submission
        return false;
    }

    function getTabs() {
        return [
        {
            href: 'library.html',
            name: Globalize.translate('HeaderLibraries')
        },
         {
             href: 'librarydisplay.html',
             name: Globalize.translate('TabDisplay')
         },
         {
             href: 'librarypathmapping.html',
             name: Globalize.translate('TabPathSubstitution')
         },
         {
             href: 'librarysettings.html',
             name: Globalize.translate('TabAdvanced')
         }];
    }

    return function (view, params) {

        var self = this;

        $('#btnSelectMetadataPath', view).on("click.selectDirectory", function () {

            require(['directorybrowser'], function (directoryBrowser) {

                var picker = new directoryBrowser();

                picker.show({

                    path: $('#txtMetadataPath', view).val(),
                    networkSharePath: $('#txtMetadataNetworkPath', view).val(),
                    callback: function (path, networkPath) {
                        if (path) {
                            $('#txtMetadataPath', view).val(path);
                            $('#txtMetadataNetworkPath', view).val(networkPath);
                        }
                        picker.close();
                    },

                    header: Globalize.translate('HeaderSelectMetadataPath'),

                    instruction: Globalize.translate('HeaderSelectMetadataPathHelp'),

                    enableNetworkSharePath: true
                });
            });

        });

        $('.librarySettingsForm').off('submit', onSubmit).on('submit', onSubmit);

        view.addEventListener('viewshow', function () {
            LibraryMenu.setTabs('librarysetup', 3, getTabs);
            Dashboard.showLoadingMsg();

            var page = this;

            ApiClient.getServerConfiguration().then(function (config) {

                loadPage(page, config);
            });

            ApiClient.getNamedConfiguration("metadata").then(function (metadata) {

                loadMetadataConfig(page, metadata);
            });

            ApiClient.getNamedConfiguration("fanart").then(function (metadata) {

                loadFanartConfig(page, metadata);
            });
        });
    };

});
