define([
    'utils/helpers',
    'utils/css',
    'events/states',
    'utils/underscore'
], function(utils, cssUtils, states, _) {
    var _style = cssUtils.style;

    var _defaults = {
        back: true,
        fontSize: 15,
        fontFamily: 'Arial,sans-serif',
        fontOpacity: 100,
        color: '#FFF',
        backgroundColor: '#000',
        backgroundOpacity: 100,
        // if back == false edgeStyle defaults to 'uniform',
        // otherwise it's 'none'
        edgeStyle: null,
        windowColor: '#FFF',
        windowOpacity: 0,
        preprocessor: _.identity
    };

    /** Component that renders the actual captions on screen. **/
    var CaptionsRenderer = function (_model) {

        var _options = {},
        // array of cues
            _captionsTrack,

        // current cue index
            _current,

        // current cues
            _currentCues,

        // last time/seek event
            _timeEvent,

        // display hierarchy
            _display,
            _captionsWindow,
            _textContainer;

        _display = document.createElement('div');
        _display.className = 'jw-captions jw-reset';


        this.show = function () {
            _display.className = 'jw-captions jw-captions-enabled jw-reset';
        };

        this.hide = function () {
            _display.className = 'jw-captions jw-reset';
        };

        /** Assign list of captions to the renderer. **/
        this.populate = function(captions) {
            _current = -1;
            _currentCues = [];
            _captionsTrack = captions;
            if (!captions) {
                _render('');
                return;
            }
            _select(captions, _timeEvent);
        };

        /** Render the active caption. **/
        function _render(html) {
            html = html || '';
            var windowClassName = 'jw-captions-window jw-reset';
            if (html) {
                _textContainer.innerHTML = html;
                _captionsWindow.className = windowClassName + ' jw-captions-window-active';
            } else {
                _captionsWindow.className = windowClassName;
                utils.empty(_textContainer);
            }
        }

        this.resize = function () {
            this.repositionCues();
            var width = _display.clientWidth,
                scale = Math.pow(width / 400, 0.6);
            if (scale) {
                var size = _options.fontSize * scale;
                _style(_display, {
                    fontSize: Math.round(size) + 'px'
                });
            }

        };

        this.repositionCues = function () {
            if(window.WebVTT) {
                window.WebVTT.processCues(window, _currentCues,_display);
            }
        };

        function _timeChange(e) {
            _timeEvent = e;
            _select(_captionsTrack, _timeEvent);
        }

        function _getAlignmentPosition(track, timeEvent) {
            var source = track.source;
            var metadata = timeEvent.metadata;

            // subtitles with "source" time must be synced with "metadata[source]"
            if (source) {
                if (metadata && _.isNumber(metadata[source])) {
                    return metadata[source];
                } else {
                    return false;
                }
            }

            // Default to syncing with current position
            return timeEvent.position;
        }

        /** Select a caption for rendering. **/
        function _select(track, timeEvent) {
            if (!(track && track.data) || !timeEvent) {
                return;
            }

            var pos = _getAlignmentPosition(track, timeEvent);
            if (pos === false) {
                return;
            }

            var data = track.data;
            if (_current >= 0 && _intersects(data, _current, pos)) {
                // no change
                return;
            }

            var found = -1;
            for (var i = 0; i < data.length; i++) {
                if (_intersects(data, i, pos)) {
                    found = i;
                    break;
                }
            }
            // If none, empty the text. If not current, re-render.
            if (found === -1) {
                _render('');
            } else if (found !== _current) {
                _current = found;
                //_render( _options.preprocessor(data[_current].text) );
                //render with vtt.js
                if(window.WebVTT) {
                    //render captions w/ vtt.js
                    _captionsWindow.className = 'jw-captions-window jw-reset jw-captions-window-active';
                    _currentCues = [data[_current]];
                    window.WebVTT.processCues(window, _currentCues,_display);
                    //window.WebVTT.processCues(window, [data[_current]],
                        //document.getElementById('overlay'));
                } else {
                    console.log('vtt.js not found');
                }
            }
        }

        function _intersects(data, i, pos) {
            return (data[i].startTime <= pos && (!data[i].endTime || data[i].endTime >= pos) &&
            (i === data.length - 1 || data[i + 1].startTime >= pos));
        }

        /** Constructor for the renderer. **/
        this.setup = function(playerElementId, options) {
            _captionsWindow = document.createElement('div');
            _textContainer = document.createElement('span');
            _captionsWindow.className = 'jw-captions-window jw-reset';
            _textContainer.className = 'jw-captions-text jw-reset';

            _options = _.extend({}, _defaults, options);

            if (options) {
                var fontOpacity = _options.fontOpacity,
                    windowOpacity = _options.windowOpacity,
                    edgeStyle = _options.edgeStyle,
                    bgColor = _options.backgroundColor,
                    windowStyle = {},
                    textStyle = {
                        color: cssUtils.hexToRgba(_options.color, fontOpacity),
                        fontFamily: _options.fontFamily,
                        fontStyle: _options.fontStyle,
                        fontWeight: _options.fontWeight,
                        textDecoration: _options.textDecoration
                    };

                if (windowOpacity) {
                    windowStyle.backgroundColor = cssUtils.hexToRgba(_options.windowColor, windowOpacity);
                }

                addEdgeStyle(edgeStyle, textStyle, fontOpacity);

                if (_options.back) {
                    textStyle.backgroundColor = cssUtils.hexToRgba(bgColor, _options.backgroundOpacity);
                } else if (edgeStyle === null) {
                    addEdgeStyle('uniform', textStyle);
                }

                _style(_captionsWindow, windowStyle);
                _style(_textContainer, textStyle);
                setupCaptionStyles(playerElementId, windowStyle, textStyle);
            }

            _captionsWindow.appendChild(_textContainer);
            _display.appendChild(_captionsWindow);

            this.populate(_model.get('captionsTrack'));
        };

        function setupCaptionStyles(playerId, windowStyle, textStyle) {
            // VTT.js DOM window styles
            cssUtils.css('#' + playerId + ' .jw-text-track-display', windowStyle, playerId);
            // VTT.js DOM text styles
            cssUtils.css('#' + playerId + ' .jw-text-track-cue', textStyle, playerId);

            // Shadow DOM window styles
            cssUtils.css('#' + playerId + ' .jw-video::-webkit-media-text-track-display', windowStyle, playerId);

            // Shadow DOM text styles
            cssUtils.css('#' + playerId + ' .jw-video::cue', textStyle, playerId);

            // Shadow DOM text background style in Safari needs to be important to override browser style
            if (textStyle.backgroundColor) {
                var backdropStyle = '{background-color: ' + textStyle.backgroundColor + ' !important;}';
                cssUtils.css('#' + playerId + ' .jw-video::-webkit-media-text-track-display-backdrop',
                    backdropStyle, playerId);
            }
        }

        function addEdgeStyle(option, style, fontOpacity) {
            var color = cssUtils.hexToRgba('#000000', fontOpacity);
            if (option === 'dropshadow') { // small drop shadow
                style.textShadow = '0 2px 1px ' + color;
            } else if (option === 'raised') { // larger drop shadow
                style.textShadow = '0 0 5px ' + color + ', 0 1px 5px ' + color + ', 0 2px 5px ' + color;
            } else if (option === 'depressed') { // top down shadow
                style.textShadow = '0 -2px 1px ' + color;
            } else if (option === 'uniform') { // outline
                style.textShadow = '-2px 0 1px ' + color + ',2px 0 1px ' + color +
                ',0 -2px 1px ' + color + ',0 2px 1px ' + color + ',-1px 1px 1px ' +
                color + ',1px 1px 1px ' + color + ',1px -1px 1px ' + color +
                ',1px 1px 1px ' + color;
            }
        }

        this.element = function() {
            return _display;
        };

        _model.on('change:playlistItem', function() {
            _timeEvent = null;
            _current = -1;
            _currentCues = [];
            _render('');
        }, this);

        _model.on('change:captionsTrack', function(model, captionsTrack) {
            this.populate(captionsTrack);
            // TODO: handle with VTT.js
        }, this);
        _model.mediaController.on('seek', function() {
            _current = -1;
            _currentCues = [];
        }, this);
        _model.mediaController.on('time seek', _timeChange, this);
        _model.mediaController.on('subtitlesTrackData', function() {
            // update captions after a provider's subtitle track changes
            _select(_captionsTrack, _timeEvent);
        }, this);
        _model.on('change:state', function(model, state) {
            switch (state) {
                case states.IDLE:
                case states.ERROR:
                case states.COMPLETE:
                    this.hide();
                    break;
                default:
                    this.show();
                    break;
            }
        }, this);
    };

    return CaptionsRenderer;
});
