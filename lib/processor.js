var fs = require('fs')
    , path = require('path')
    , url = require('url')
    , moment = require('moment')
    , mime = require('mime')
    , sizeOf = require('image-size');

var Processor = function(options) {
    this.options = options || {};

    this.paths = {
        images_path: 'public/images',
        css_path:    'public/stylesheets',
        fonts_path:  'public/fonts',
        http_images_path: '/images',
        http_fonts_path:  '/fonts',
        http_css_path: '/stylesheets'
    };

    var path;
    for(path in this.paths) {
        if(this.options[path]) {
            this.paths[path] = this.options[path];
        }
    }
    this.paths['generated_images_path'] = this.paths['generated_images_path'] || this.paths['images_path'];
    this.paths['http_generated_images_path'] = this.paths['http_generated_images_path'] || this.paths['http_images_path'];
};

Processor.prototype.asset_cache_buster = function(http_path, real_path, done) {
    if (typeof this.options.asset_cache_buster !== 'function') {
        throw new Error('asset_cache_buster should be a function');
    }
    var http_path_url = url.parse(http_path), new_url;

    this.options.asset_cache_buster(http_path, real_path, function(value) {
        if (typeof value == 'object') {
            var parsed_path = url.parse(value.path);
            new_url = {
                pathname: parsed_path.pathname,
                search: value.query || http_path_url.search
            };
        } else {
            new_url = {
                pathname: http_path_url.pathname,
                search: value
            };
        }

        done(url.format(new_url));
    });
};

Processor.prototype.asset_host = function(filepath, done) {
    if (typeof this.options.asset_host !== 'function') {
        throw new Error('asset_host should be a function');
    }
    this.options.asset_host(filepath, function(host) {
        done(url.resolve(host, filepath));
    });
};

Processor.prototype.real_path = function(filepath, segment) {
    var sanitized_filepath = filepath.replace(/(#|\?).+$/, '');
    return path.resolve(this.paths[segment + '_path'], sanitized_filepath);
};

Processor.prototype.http_path = function(filepath, segment) {
    return path.join(this.paths['http_' + segment + '_path'], filepath).replace(/\\/g, '/');
};

Processor.prototype.image_width = function(filepath, done) {
    done(sizeOf(this.real_path(filepath, 'images')).width);
};

Processor.prototype.image_height = function(filepath, done) {
    done(sizeOf(this.real_path(filepath, 'images')).height);
};

Processor.prototype.inline_image = function(filepath, mime_type, done) {
    var src = this.real_path(filepath, 'images');

    mime_type = mime_type || mime.lookup(src);
    var data = fs.readFileSync(src);
    done('data:' + mime_type + ';base64,' + data.toString('base64'));
};

Processor.prototype.asset_url = function(filepath, segment, done) {
    var http_path = sanitized_http_path = this.http_path(filepath, segment);
    var real_path = this.real_path(filepath, segment);

    var fragmentIndex = sanitized_http_path.indexOf('#'), fragment = '';
    if (~fragmentIndex) {
        fragment = sanitized_http_path.substring(fragmentIndex);
        sanitized_http_path = sanitized_http_path.substring(0, fragmentIndex);
    }

    var restoreFragment = function(url) {
        done(url + fragment);
    };

    var next = function(http_path) {
        if (this.options.asset_host) {
            this.asset_host(http_path, restoreFragment);
        } else {
            restoreFragment(http_path);
        }
    }.bind(this);

    if (this.options.asset_cache_buster) {
        this.asset_cache_buster(sanitized_http_path, real_path, next);
    } else {
        next(sanitized_http_path);
    }
};

Processor.prototype.image_url = function(filepath, done) {
    this.asset_url(filepath, 'images', done);
};

Processor.prototype.font_url = function(filepath, done) {
    this.asset_url(filepath, 'fonts', done);
};

var FONT_TYPES = {
    woff: 'woff',
    woff2: 'woff2',
    otf: 'opentype',
    opentype: 'opentype',
    ttf: 'truetype',
    truetype: 'truetype',
    svg: 'svg',
    eot: 'embedded-opentype'
};
var DEFAULT_DISPLAY = {
    "block" : ("address article aside blockquote center dir div dd details dl dt " +
    "fieldset figcaption figure form footer frameset h1 h2 h3 h4 h5 h6 hr header " +
    "hgroup isindex main menu nav noframes noscript ol p pre section summary ul").split(' '),
    "inline" : ("a abbr acronym audio b basefont bdo big br canvas cite code command datalist " +
    "dfn em embed font i img input keygen kbd label mark meter output progress q rp rt ruby " +
    "s samp select small span strike strong sub sup textarea time tt u var video wbr").split(' '),
    "inline-block" : ["img"],
    "table" : ["table"],
    "list-item" : ["li"],
    "table-row-group" : ["tbody"],
    "table-header-group" : ["thead"],
    "table-footer-group" : ["tfoot"],
    "table-row" : ["tr"],
    "table-cell" : "th td".split(' '),
    "html5-block" : "article aside details figcaption figure footer header hgroup main menu nav section summary".split(' '),
    "html5-inline" : "audio canvas command datalist embed keygen mark meter output progress rp rt ruby time video wbr".split(' '),
    "text-input" : "input textarea".split(' ')
};

DEFAULT_DISPLAY["html5"] = Array.from(new Set(DEFAULT_DISPLAY["html5-block"].concat(DEFAULT_DISPLAY["html5-inline"])));
var COMMA_SEPARATOR = /\s*,\s*/;

Processor.prototype.font_files = function(files, done) {
    var processed_files = [], count = 0;

    var complete = function(index, type) {
        return function(url) {
            processed_files[index] = {url: url, type: type};
            if (++count == files.length) {
                done(processed_files);
            }
        };
    };

    var i = 0, parts, ext, file, next, type;
    for (; i < files.length; ++i) {
        file = files[i];
        next = files[i + 1];

        parts = url.parse(file);
        if (FONT_TYPES[next]) {
            type = files.splice(i + 1, 1);
        } else {
            ext = path.extname(parts.path);
            type = ext.substring(1);
        }
        type = FONT_TYPES[type];
        this.font_url(file, complete(i, type));
    }
};




//https://github.com/Compass/compass/blob/stable/core/lib/compass/core/sass_extensions/functions/cross_browser_support.rb
Processor.prototype.opposite_position = function(position){
    switch(position){
        case "top": return "bottom";
        case "bottom": return "top";
        case "left": return "right";
        case "right": return "left";
        case "center": return "center";
        default:
            return false;
    }
};
Processor.prototype.elements_of_type = function(display){
    return (DEFAULT_DISPLAY[display] || []).join(',');
};
Processor.prototype.current_time = function(format){
    return moment().format(format||"HH:mm:ssZ");
};
Processor.prototype.current_date = function(format){
    return moment().format(format||"YYYY-MM-DD");
};
Processor.prototype.stylesheet_url = function(filepath, done){
    this.asset_url(filepath, 'css', done);
};
Processor.prototype.inline_font_files = function(files, done){
    var processed_files = [], count = 0;

    var complete = function(index, type) {
        return function(url) {
            processed_files[index] = {url: url, type: type};
            if (++count == files.length) {
                done(processed_files);
            }
        };
    };

    var i = 0, parts, ext, file, next, type;
    for (; i < files.length; ++i) {
        file = files[i];     // file
        next = files[i + 1]; // file format

        parts = url.parse(file);
        if (FONT_TYPES[next]) {
            type = files.splice(i + 1, 1);
        } else {
            ext = path.extname(parts.path);
            type = ext.substring(1);
        }
        type = FONT_TYPES[type];
        var src = this.real_path(file, 'fonts');

        var mime_type = mime.lookup(src);
        var data = fs.readFileSync(src);

        complete(i, type)('data:' + mime_type + ';base64,' + data.toString('base64'));
    }
};



/* ==================================================== SELECTORS ================================================ */
Processor.prototype.nest = function(selectors){

};
Processor.prototype.append_selector = function(selector, to_append){

};
Processor.prototype.enumerate = function(prefix, _from, through, separator){
    separator = separator || "-";


};
Processor.prototype.headings = function(_from, _to){
    if(_from && !_to){
        if(typeof _from === "string" && _from === "all"){
            _from = 1;
            _to = 6;
        }
        else{
            _to = _from;
            _from = 1;
        }
    }
    else{
        _from = _from || 1;
        _to = _to || 6;
    }

    var _result = [];  //separator "," !!!
    for(var i = 0, j = Math.min(_from, _to); j <= Math.max(_from, _to) ;i++, j++){
        _result[i] = 'h'+j;
    }
    return _result;
};


/* ====================================================== COLORS ========================================================== */
Processor.prototype.color_stops = function(color_stops){

};
Processor.prototype.adjust_lightness = function(color, amount){

};
Processor.prototype.adjust_saturation = function(color, amount){

};
Processor.prototype.scale_lightness = function(color, amount){

};
Processor.prototype.scale_saturation = function(color, amount){

};
Processor.prototype.shade = function(color, percentage){

};
Processor.prototype.tint = function(color, percentage){

};


/* ========================================================== IMAGES ======================================================= */
Processor.prototype.generated_image_url = function(path){
    this.asset_url(filepath, 'generated_images', done);
};



/* ========================================================== SPRITES ======================================================= */
Processor.prototype.sprite = function(map, sprite, offset_x, offset_y, use_percentages){

};
Processor.prototype.sprite_map = function(globs){

};
Processor.prototype.sprite_map_name = function(map){

};
Processor.prototype.sprite_width = function(map){

};
Processor.prototype.sprite_height = function(map){

};
Processor.prototype.sprite_path = function(map){

};
Processor.prototype.sprite_names = function(map){

};
Processor.prototype.sprite_file = function(map, sprite){

};
Processor.prototype.sprite_url = function(map){

};
Processor.prototype.sprite_position = function(map, sprite, offset_x, offset_y, use_percentages){

};


/* =============================================================== Mathematics ======================================================== */
Processor.prototype.logarithm = function(number, base){
    return Math.log(number)/(base ? Math.log(base) : 1);
};


/* ================================================================ CROSS-BROWSER ================================================================ */
Processor.prototype.prefixed = function(prefix, value){
    return typeof value === "string" && value.match(prefix + "-");
};
Processor.prototype.prefix = function(prefix, value){
    return typeof value === "string" && value.match(prefix + "-") === null ? prefix + '-' + value : value;
};
Processor.prototype.css2_fallback = function(value, css2_value){

};



module.exports = Processor;
