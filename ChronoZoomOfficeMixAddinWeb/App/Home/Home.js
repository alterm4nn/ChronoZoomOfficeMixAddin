var WebPageApp;
(function (WebPageApp) {
    function createCallback(deferred) {
        return function (err, data) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(data);
            }
        };
    }

    (function (UserEditMode) {
        UserEditMode[UserEditMode["Preview"] = 0] = "Preview";
        UserEditMode[UserEditMode["Edit"] = 1] = "Edit";
    })(WebPageApp.UserEditMode || (WebPageApp.UserEditMode = {}));
    var UserEditMode = WebPageApp.UserEditMode;

    var serviceUri = "www.chronozoom.com/";

    var requestedLink = serviceUri + "czmin/#/t00000000-0000-0000-0000-000000000000"

    function Request(urlBase) {
        var _url = urlBase;
        var _hasParameters = false;

        Object.defineProperty(this, "url", {
            configurable: false,
            get: function () {
                return _url;
            }
        });

        this.addToPath = function (item) {
            if (item) {
                _url += _url.match(/\/$/) ? item : "/" + item;
            }
        };

        this.addParameter = function (name, value) {
            if (value !== undefined && value !== null) {
                _url += _hasParameters ? "&" : "?";
                _url += name + "=" + value;
                _hasParameters = true;
            }
        };

        this.addParameters = function (params) {
            for (var p in params) {
                if (params.hasOwnProperty(p)) {
                    this.addParameter(p, params[p]);
                }
            }
        };
    }

    function getSuperCollections(_serviceUri) {
        var request = new Request(_serviceUri);
        request.addToPath("api");
        request.addToPath("supercollections");
        return $.ajax
        ({
            type: "GET",
            cache: false,
            dataType: "json",
            url: request.url
        });
    }

    function getCollections(i,supercollections, collectionsObservable, _serviceUri) {
        var supercollection = supercollections[i];

        var request = new Request(_serviceUri);

        request.addToPath("api");
        request.addToPath(supercollection.Title);
        request.addToPath("collections");

        return $.ajax({
            type: "GET",
            cache: false,
            dataType: "json",
            url: request.url
        }).done(function (response) {
            for (var j = 0; j < response.length; j++)
                if (response[j].PubliclySearchable) {
                    collectionsObservable.push({
                        title: supercollection.Title + "/" + response[j].Title,
                        path: supercollection.Title + "/" + response[j].Path
                    });
                }
            if (i + 1 < supercollections.length)
                getCollections(i + 1, supercollections, collectionsObservable, _serviceUri);
        });
    }

    var AppViewModel = (function () {
        function AppViewModel(mode) {
            var _this = this;
            this._modeSwitchP = $.when();
            this.error = ko.observable(false);
            this.userEditMode = ko.observable(UserEditMode.Edit);
            this.labMode = ko.observable(null);
            this.mode = ko.observable("default");
            this.selectedCollection = ko.observable(null);
            this.selectedCollection.subscribe(function () {
                _this.mode("collection");
            });

            this.customCode = ko.observable("")
            this.customCode.subscribe(function () {
                _this.mode("link");
            });

            this.supercollections = ko.observableArray(new Array());
            this.collections = ko.observableArray(new Array());
           
            this.uri = ko.computed({
                read: function () {
                    var uri;
                    if (_this.mode() === "default")
                        uri = serviceUri + "czmin/";
                    else if (_this.mode() === "collection") {

                        var coll = _this.selectedCollection();
                        if (coll) {
                            var collPath = coll.path;
                            uri = serviceUri + "czmin/" + collPath + "/";
                        }
                    }
                    else if (_this.mode() === "link") {
                        var code = _this.customCode();
                        if (/^.*http.*/.test(code)) {
                            code = /https?:\/\/.*\/\"/.exec(code)[0];
                            code = code.replace("\"", "");
                            code = code.replace("https://", "");
                            code = code.replace("http://", "");
                            uri = code;
                        }
                    }
                    return uri;
                },
            }, this);

            this.absoluteUri = ko.computed(function () {
                return 'https://' + _this.uri();
            });


            getSuperCollections('https://' + serviceUri).done(function (response) {
                _this.supercollections(response);
                getCollections(0, _this.supercollections(), _this.collections, 'https://' + serviceUri);
                _this.mode("default");
            });

            this.inputColor = ko.observable("#FFFFFF");
            ko.bindingHandlers.backgroundColor = {
                update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
                    $(element).stop(true, false);
                    var koko = valueAccessor()();
                    $(element).animate({ backgroundColor: valueAccessor()() }, 50);
                    valueAccessor()("#FFFFFF");
                    $(element).animate({ backgroundColor: valueAccessor()() }, 1000);
                }
            }

            this.switchEditModeText = ko.computed(function () {
                return _this.userEditMode() === UserEditMode.Preview ? UserEditMode[UserEditMode.Edit] : UserEditMode[UserEditMode.Preview];
            });

            this.appTemplate = ko.computed(function () {
                var error = _this.error();
                var labMode = _this.labMode();

                if (error) {
                    return "errorTemplate";
                } else if (labMode === null) {
                    return "loadingTemplate";
                } else {
                    return "appTemplate";
                }
            });

            this.showWebPage = ko.computed(function () {
                return _this.labMode() === Labs.Core.LabMode.View || _this.userEditMode() === UserEditMode.Preview;
            });

            Labs.on(Labs.Core.EventTypes.ModeChanged, function (data) {
                var modeChangedEvent = data;
                _this.switchToMode(Labs.Core.LabMode[modeChangedEvent.mode]);
            });

            this.uri.subscribe(function (newValue) {
                if (_this._labEditor) {
                    var configuration = _this.getConfigurationFromUri(newValue);
                    _this._labEditor.setConfiguration(configuration, function (setConfigurationErr, unused) {
                        if (setConfigurationErr) {
                            _this.error(true);
                        }
                    });
                }
            });

            this.switchToMode(mode);
        }
        AppViewModel.prototype.switchUserMode = function () {
            if (this.mode() === "link" && !/^.*https?::\/\/cz-alexn-test\.azurewebsites\.net.*".*/.test(this.customCode())) {
                this.inputColor("#FF5555");
            } else 
                this.userEditMode(this.userEditMode() === UserEditMode.Preview ? UserEditMode.Edit : UserEditMode.Preview);
        };

        AppViewModel.prototype.switchToMode = function (mode) {
            var _this = this;
            this._modeSwitchP = this._modeSwitchP.then(function () {
                var switchedStateDeferred = $.Deferred();

                if (_this._labInstance) {
                    _this._labInstance.done(createCallback(switchedStateDeferred));
                } else if (_this._labEditor) {
                    _this._labEditor.done(createCallback(switchedStateDeferred));
                } else {
                    switchedStateDeferred.resolve();
                }

                return switchedStateDeferred.promise().then(function () {
                    _this._labEditor = null;
                    _this._labInstance = null;

                    if (mode === Labs.Core.LabMode.Edit) {
                        return _this.switchToEditMode();
                    } else {
                        return _this.switchToShowMode();
                    }
                });
            });

            this._modeSwitchP.fail(function () {
                return _this.error(true);
            });
        };

        AppViewModel.prototype.switchToEditMode = function () {
            var _this = this;
            var editLabDeferred = $.Deferred();
            Labs.editLab(createCallback(editLabDeferred));

            return editLabDeferred.promise().then(function (labEditor) {
                _this._labEditor = labEditor;

                var configurationDeferred = $.Deferred();
                labEditor.getConfiguration(createCallback(configurationDeferred));

                return configurationDeferred.promise().then(function (configuration) {
                    /*if (configuration) {
                        _this.uri((configuration.components[0]).data.uri);
                    } else {
                        _this.uri("www.wikipedia.org");
                    }*/
                    _this.labMode(Labs.Core.LabMode.Edit);
                });
            });
        };

        AppViewModel.prototype.switchToShowMode = function () {
            var _this = this;
            var takeLabDeferred = $.Deferred();
            Labs.takeLab(createCallback(takeLabDeferred));

            return takeLabDeferred.promise().then(function (labInstance) {
                _this._labInstance = labInstance;

                var activityComponentInstance = _this._labInstance.components[0];
                //_this.uri(activityComponentInstance.component.data.uri);// there is needed uri

                var attemptsDeferred = $.Deferred();
                activityComponentInstance.getAttempts(createCallback(attemptsDeferred));
                var attemptP = attemptsDeferred.promise().then(function (attempts) {
                    var currentAttemptDeferred = $.Deferred();
                    if (attempts.length > 0) {
                        currentAttemptDeferred.resolve(attempts[attempts.length - 1]);
                    } else {
                        activityComponentInstance.createAttempt(createCallback(currentAttemptDeferred));
                    }

                    return currentAttemptDeferred.then(function (currentAttempt) {
                        var resumeDeferred = $.Deferred();
                        currentAttempt.resume(createCallback(resumeDeferred));
                        return resumeDeferred.promise().then(function () {
                            return currentAttempt;
                        });
                    });
                });

                return attemptP.then(function (attempt) {
                    var completeDeferred = $.Deferred();
                    if (attempt.getState() !== Labs.ProblemState.Completed) {
                        attempt.complete(createCallback(completeDeferred));
                    } else {
                        completeDeferred.resolve();
                    }
                    _this.labMode(Labs.Core.LabMode.View);
                    return completeDeferred.promise();
                });
            });
        };

        AppViewModel.prototype.getConfigurationFromUri = function (uri) {
            var appVersion = { major: 1, minor: 0 };
            var configurationName = uri;
            var activityComponent = {
                type: Labs.Components.ActivityComponentType,
                name: uri,
                values: {},
                data: {
                    uri: uri
                },
                secure: false
            };
            var configuration = {
                appVersion: appVersion,
                components: [activityComponent],
                name: configurationName,
                timeline: null,
                analytics: null
            };

            return configuration;
        };
        return AppViewModel;
    })();

    $(document).ready(function () {
        Labs.connect(function (err, connectionResponse) {
            var viewModel = new AppViewModel(connectionResponse.mode);
            ko.applyBindings(viewModel);
        });
    });
})(WebPageApp || (WebPageApp = {}));
