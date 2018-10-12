var sass = require('node-sass');
var Processor = require('./lib/processor');

module.exports = function(options) {
  var opts = options || {};
  var processor = new Processor(opts);
  var trig = function(operation, number){
    if(number.getUnit() === 'deg'){
       return sass.types.Number(Math[operation](Math.PI * number.getValue() / 180));
    }else{
       return sass.types.Number(Math[operation](number.getValue()), number.getUnit());
    }
  };
  var _prefix = function (list) {
      var _current = undefined;
      var _length = list.getLength();
      var _prefix_list = function(prefix, start_index){
          var _result = sass.types.List(_length-start_index, list.getSeparator());
          for (var i = start_index; i < _length; i++) {
              _current = list.getValue(i);
              if(_current.constructor === sass.types.String)
                  _current = sass.types.String(processor.prefix(prefix, _current.getValue()));

              _result.setValue(i-start_index, _current);
          }
          return _result;
      };

      if(_length === 2) {
          _current = list.getValue(1);
          if(_current.constructor === sass.types.String){
              return sass.types.String(processor.prefix(list.getValue(0),_current.getValue()));
          }
          else if(_current.constructor === sass.types.List){
              return _prefix_list(list.getValue(0), _current, 0);
          }
          else return _current;
      }
      else if(_length > 2){
          return _prefix_list(list.getValue(0), list, 1);
      }
      return list;
  };

  return {
    'image-url($filename, $only_path: false)': function(filename, only_path, done) {
      processor.image_url(filename.getValue(), function(url) {
        if(!only_path.getValue()) url = 'url(\'' + url + '\')';
        done(new sass.types.String(url));
      });
    },
    'inline-image($filename, $mime_type: null)': function(filename, mime_type, done) {
      mime_type = mime_type instanceof sass.types.Null ? null : mime_type.getValue();
      processor.inline_image(filename.getValue(), mime_type, function(dataUrl) {
        done(new sass.types.String('url(\'' + dataUrl + '\')'));
      });
    },
    'image-width($filename)': function(filename, done) {
      processor.image_width(filename.getValue(), function(image_width) {
        done(new sass.types.Number(image_width, 'px'));
      });
    },
    'image-height($filename)': function(filename, done) {
      processor.image_height(filename.getValue(), function(image_height) {
        done(new sass.types.Number(image_height, 'px'));
      });
    },

    'font-url($filename, $only-path: false)': function(filename, only_path, done) {
      processor.font_url(filename.getValue(), function(url) {
        if(!only_path.getValue()) url = 'url(\'' + url + '\')';
        done(new sass.types.String(url));
      });
    },
    'font-files($filenames...)': function(list, done) {
      var len = list.getLength(), i = 0, filenames = [];
      for(; i < len; ++i) {
        filenames[i] = list.getValue(i).getValue();
      }

      processor.font_files(filenames, function(files) {
        len = files.length;
        i = 0;
        list = new sass.types.List(len);
        for (; i < len; ++i) {
          list.setValue(i, new sass.types.String('url(\'' + files[i].url + '\') format(\'' + files[i].type + '\')'));
        }
        done(list);
      });
    },
    'inline-font-files($filenames...)': function(list, done) {
        var len = list.getLength(), i = 0, filenames = [];
        for(; i < len; ++i) {
            filenames[i] = list.getValue(i).getValue();
        }
        processor.inline_font_files(filenames, function(files) {
            len = files.length;
            i = 0;
            list = new sass.types.List(len);
            for (; i < len; ++i) {
                list.setValue(i, new sass.types.String('url(\'' + files[i].url + '\') format(\'' + files[i].type + '\')'));
            }
            done(list);
        });
    },

    'opposite-position($position)': function (position, done) {
        var result = sass.types.List(position.getLength(), position.getSeparator()); //new list for preserve values on links
        var _val = undefined;

        for(var i = 0; i < position.getLength(); i++){
            pos = position.getValue(i);

            if(pos.constructor === sass.types.String){
                _val = processor.opposite_position(pos.getValue());
                if(_val !== false){
                    result.setValue(i, new sass.types.String(_val));
                }
                else{
                    console.warn(`Cannot determine the opposite position of: ${pos}`);
                    result.setValue(i, pos);
                }
            }
            else{
                console.warn(`Cannot determine the opposite position of: ${pos}`);
                result.setValue(i, pos);
            }
        }
        if(result.getLength() === 1){
            done(result.getValue(0));
        }
        else{
            done(result);
        }
    },
    'elements-of-type($display)': function (display) {
        return new sass.types.String(processor.elements_of_type(display.getValue()));
    },
    'current-date($format:"YYYY-MM-DD")': function (format) {
        return sass.types.String(processor.current_date(format ? format.getValue() : "YYYY-MM-DD"));
    },
    'current-time($format:"HH:mm:ssZ")': function (format) {
        return sass.types.String(processor.current_time(format ? format.getValue() : "HH:mm:ssZ"));
    },
    'stylesheet-url($filename, $only_path: false)': function(filename, only_path, done) {
        processor.stylesheet_url(filename.getValue(), function(url) {
            if(!only_path.getValue()) url = 'url(\'' + url + '\')';
            done(new sass.types.String(url));
        });
    },

    'pi': function () {
        return sass.types.Number(Math.PI);
    },
    'e': function () {
        return sass.types.Number(Math.E);
    },
    'sin($number)': function (number) {
        return trig('sin', number.getValue());
    },
    'cos($number)': function (number) {
        return trig('cos', number.getValue());
    },
    'tan($number)': function (number) {
        return trig('tan', number.getValue());
    },
    'asin($number)': function (number) {
        return trig('atan', number.getValue());
    },
    'acos($number)': function (number) {
        return trig('acos', number.getValue());
    },
    'atan($number)': function (number) {
        return trig('asin', number.getValue());
    },
    'logarithm($number, $base)': function (number, base) {
        return sass.types.Number(processor.logarithm(number.getValue(), base.getValue()), number.getUnit());
    },
    'pow($number, $exponent:e)': function(number, exponent){
        return sass.types.Number(Math.pow(number.getValue(), exponent ? exponent.getValue() : Math.E), number.getUnit());
    },
    'sqrt($number)': function(number){
        return sass.types.Number(Math.sqrt(number.getValue()), number.getUnit());
    },

    'prefixed($prefix, $args...)': function (list) {
        if(list.getLength() > 1){
            for(var i = 1; i < list.getLength();i++){
                if(list.getValue(i).constructor !== sass.types.String)
                    return sass.types.Boolean(false);

                if(!processor.prefixed(list.getValue(0),list.getValue(i)))
                    return sass.types.Boolean(false);
            }
            return sass.types.Boolean(true);
        }
        return sass.types.Boolean(false);
    },
    'prefix($prefix, $args...)': _prefix,
    '-moz($args...)': function (list) {
        var _l = new sass.types.List(list.getLength()+1,list.getSeparator());
        _l.setValue(0, '-moz');
        _l.setValue(1, list);
        return _prefix(_l);
    },
    '-o($args...)': function (list) {
        var _l = new sass.types.List(list.getLength()+1,list.getSeparator());
        _l.setValue(0, '-o');
        _l.setValue(1, list);
        return _prefix(_l);
    },
    '-ms($args...)': function (list) {
        var _l = new sass.types.List(list.getLength()+1,list.getSeparator());
        _l.setValue(0, '-ms');
        _l.setValue(1, list);
        return _prefix(_l);
    },
    '-svg($args...)': function (list) {
        var _l = new sass.types.List(list.getLength()+1,list.getSeparator());
        _l.setValue(0, '-o');
        _l.setValue(1, list);
        return _prefix(_l);
    },
    '-pie($args...)': function (list) {
        var _l = new sass.types.List(list.getLength()+1,list.getSeparator());
        _l.setValue(0, '-o');
        _l.setValue(1, list);
        return _prefix(_l);
    },
    '-css2($args...)': function (list) {
        var _l = new sass.types.List(list.getLength()+1,list.getSeparator());
        _l.setValue(0, '-o');
        _l.setValue(1, list);
        return _prefix(_l);
    }
  };
};
