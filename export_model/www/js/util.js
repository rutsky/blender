function getSync(url)
{
  var val = null;

  $.ajax({
    'async': false,
    'global': false,
    'url': url,
    'success': function(data) {
      val = data;
    },
    'error': function() {
      alert("Failed to get '" + url + "'");
    }
  });

  return val;
};


// From <http://stackoverflow.com/a/7183523>
function rawStringToBuffer(str, offset, length)
{
  if (offset == undefined)
  {
    var offset = 0;
  }

  if (length == undefined)
  {
    var length = str.length;
  }
  else
  {
    if (length > str.length)
    {
      var length = str.length;
    }
  }

  var arr = new Array(length);
  var idx;
  for (idx = offset; idx < length + offset; ++idx) 
  {
    arr[idx - offset] = str.charCodeAt(idx) & 0xFF;
  }
  // You may create an ArrayBuffer from a standard array (of values) as follows:
  return new Uint8Array(arr).buffer;
}

// vim: set sw=2 ts=2 et:
