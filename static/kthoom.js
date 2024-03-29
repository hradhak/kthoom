/*
 * kthoom.js
 *
 * Licensed under the MIT License
 *
 * Copyright(c) 2011 Google Inc.
 * Copyright(c) 2011 antimatter15
 */

/* Reference Documentation:

  * Web Workers: http://www.whatwg.org/specs/web-workers/current-work/
  * Web Workers in Mozilla: https://developer.mozilla.org/En/Using_web_workers
  * File API (FileReader): http://www.w3.org/TR/FileAPI/
  * Typed Arrays: http://www.khronos.org/registry/typedarray/specs/latest/#6

*/

if (!window.console) {
  window.console = {};
  window.console.log = function(str) {};
  window.console.dir = function(str) {};
}
if (window.opera) {
  window.console.log = function(str) {opera.postError(str);};
  window.console.dir = function(str) {};
}

// gets the element with the given id
function getElem(id) {
  if (document.documentElement.querySelector) {
    // querySelector lookup
    return document.body.querySelector('#' + id);
  }  
  // getElementById lookup
  return document.getElementById(id);
}

if (window.kthoom == undefined) {
  window.kthoom = {};
}

// key codes
kthoom.Key = {
    ESCAPE: 27,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40, 
    A: 65, B: 66, C: 67, D: 68, E: 69, F: 70, G: 71, H: 72, I: 73, J: 74, K: 75, L: 76, M: 77, 
    N: 78, O: 79, P: 80, Q: 81, R: 82, S: 83, T: 84, U: 85, V: 86, W: 87, X: 88, Y: 89, Z: 90,
    QUESTION_MARK: 191,
    LEFT_SQUARE_BRACKET: 219,
    RIGHT_SQUARE_BRACKET: 221
};

// The rotation orientation of the comic.
kthoom.rotateTimes = 0;

// global variables
var unarchiver = null;
var currentImage = 0;
var imageFiles = [];
var imageFilenames = [];
var totalImages = 0;
var lastCompletion = 0;
var library = {
  allBooks: [],
  currentBookNum: 0,
};
  
var hflip = false, vflip = false, fitMode = kthoom.Key.B;
var canKeyNext = true, canKeyPrev = true;

kthoom.saveSettings = function() {
  localStorage.kthoom_settings = JSON.stringify({
    rotateTimes: kthoom.rotateTimes,
    hflip: hflip,
    vflip: vflip,
    fitMode: fitMode
  });
}

kthoom.loadSettings = function() {
  try {
    if (localStorage.kthoom_settings.length < 10) return;
    var s = JSON.parse(localStorage.kthoom_settings);
    kthoom.rotateTimes = s.rotateTimes;
    hflip = s.hflip;
    vflip = s.vflip;
    fitMode = s.fitMode;
  } catch(err) {
  }
}

// Stores an image filename and its data: URI.
// TODO: investigate if we really need to store as base64 (leave off ;base64 and just
//       non-safe URL characters are encoded as %xx ?)
//       This would save 25% on memory since base64-encoded strings are 4/3 the size of the binary
kthoom.ImageFile = function(file) {
  this.filename = file.filename;
  var fileExtension = file.filename.split('.').pop().toLowerCase();
  var mimeType = fileExtension == 'png' ? 'image/png' :
      (fileExtension == 'jpg' || fileExtension == 'jpeg') ? 'image/jpeg' :
      fileExtension == 'gif' ? 'image/gif' : undefined;
  this.dataURI = createURLFromArray(file.fileData, mimeType);
  this.data = file;
};

kthoom.resetFileUploader = function() {
  getElem('menu').addEventListener('click', function(evt) {
    var elem = evt.currentTarget;
    elem.classList.toggle('opened');
  });
  getElem('menu-open-local-files').addEventListener('change',
      getLocalFiles, false);

  getElem('menu-open-local-book').addEventListener('click', getRemoteFile, false);

}

kthoom.initProgressMeter = function() {
  var svgns = 'http://www.w3.org/2000/svg';
  var pdiv = document.getElementById('progress');
  var svg = document.createElementNS(svgns, 'svg');
  svg.style.width = '100%';
  svg.style.height = '100%';
  
  var defs = document.createElementNS(svgns, 'defs');

  var patt = document.createElementNS(svgns, 'pattern');
  patt.id = 'progress_pattern';
  patt.setAttribute('width', '30');
  patt.setAttribute('height', '20');
  patt.setAttribute('patternUnits', 'userSpaceOnUse');

  var rect = document.createElementNS(svgns, 'rect');
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', '#cc2929');
  
  var poly = document.createElementNS(svgns, 'polygon');
  poly.setAttribute('fill', 'yellow');
  poly.setAttribute('points', '15,0 30,0 15,20 0,20');

  patt.appendChild(rect);
  patt.appendChild(poly);
  defs.appendChild(patt);
  
  svg.appendChild(defs);
  
  var g = document.createElementNS(svgns, 'g');
  
  var outline = document.createElementNS(svgns, 'rect');
  outline.setAttribute('y', '1');
  outline.setAttribute('width', '100%');
  outline.setAttribute('height', '15');
  outline.setAttribute('fill', '#777');
  outline.setAttribute('stroke', 'white');
  outline.setAttribute('rx', '5');
  outline.setAttribute('ry', '5');
  g.appendChild(outline);

  var title = document.createElementNS(svgns, 'text');
  title.id = 'progress_title';
  title.appendChild(document.createTextNode('0%'));
  title.setAttribute('y', '13');
  title.setAttribute('x', '99.5%');
  title.setAttribute('fill', 'white');
  title.setAttribute('font-size', '12px');
  title.setAttribute('text-anchor', 'end');
  g.appendChild(title);

  var meter = document.createElementNS(svgns, 'rect');
  meter.id = 'meter';
  meter.setAttribute('width', '0%');
  meter.setAttribute('height', '17');
  meter.setAttribute('fill', 'url(#progress_pattern)');
  meter.setAttribute('rx', '5');
  meter.setAttribute('ry', '5');
  
  var meter2 = document.createElementNS(svgns, 'rect');
  meter2.id = 'meter2';
  meter2.setAttribute('width', '0%');
  meter2.setAttribute('height', '17');
  meter2.setAttribute('opacity', '0.8');
  meter2.setAttribute('fill', '#007fff');
  meter2.setAttribute('rx', '5');
  meter2.setAttribute('ry', '5');
  
  g.appendChild(meter);
  g.appendChild(meter2);
  
  var page = document.createElementNS(svgns, 'text');
  page.id = 'page';
  page.appendChild(document.createTextNode('0/0'));
  page.setAttribute('y', '13');
  page.setAttribute('x', '0.5%');
  page.setAttribute('fill', 'white');
  page.setAttribute('font-size', '12px');
  g.appendChild(page);
  
  
  svg.appendChild(g);
  pdiv.appendChild(svg);
  
  svg.onclick = function(e) {
    for (var x = pdiv, l = 0; x != document.documentElement; x = x.parentNode) l += x.offsetLeft;
    var page = Math.max(1, Math.ceil(((e.clientX - l)/pdiv.offsetWidth) * totalImages)) - 1;
    currentImage = page;
    updatePage();
  };
}

kthoom.setProgressMeter = function(pct, opt_label) {
  var pct = (pct*100);
  var part = 1/totalImages;
  var remain = ((pct - lastCompletion)/100)/part;
  var fract = Math.min(1, remain);
  var smartpct = ((imageFiles.length/totalImages) + fract * part )* 100;
  if (totalImages == 0) smartpct = pct;
  
   // + Math.min((pct - lastCompletion), 100/totalImages * 0.9 + (pct - lastCompletion - 100/totalImages)/2, 100/totalImages);
  var oldval = parseFloat(getElem('meter').getAttribute('width'));
  if (isNaN(oldval)) oldval = 0;
  var weight = 0.5;
  smartpct = (weight * smartpct + (1-weight) * oldval);
  if (pct == 100) smartpct = 100;
    
  if (!isNaN(smartpct)) {
    getElem('meter').setAttribute('width', smartpct + '%');
  }
  var title = getElem('progress_title');
  while (title.firstChild) title.removeChild(title.firstChild);

  var labelText = pct.toFixed(2) + '% ' + imageFiles.length + '/' + totalImages + '';
  if (opt_label) {
    labelText = opt_label + ' ' + labelText;
  }
  title.appendChild(document.createTextNode(labelText));
  // fade it out as it approaches finish
  //title.setAttribute('fill-opacity', (pct > 90) ? ((100-pct)*5)/100 : 1);

  getElem('meter2').setAttribute('width',
      100 * (totalImages == 0 ? 0 : ((currentImage+1)/totalImages)) + '%');
  
  var title = getElem('page');
  while (title.firstChild) title.removeChild(title.firstChild);
  title.appendChild(document.createTextNode( (currentImage+1) + '/' + totalImages ));
  
  
  if (pct > 0) {
    getElem('nav').className = '';
    getElem('progress').className = '';
  }
}

// Attempts to read the files that the user has chosen.
function getLocalFiles(evt) {
  var filelist = evt.target.files;

  console.log(filelist);

  library.allBooks = filelist;
  library.currentBookNum = 0;

  closeBook();
  loadSingleBook(filelist[0]);

  // Only show library if we have more than one book.
  if (filelist.length > 1) {
    showLibrary(true);
    updateLibrary();
  }
}

function getRemoteFile(evt) {
  console.log("getRemoteFile");

  var xhr = new XMLHttpRequest();

  xhr.open('GET', 'book', true);
  xhr.responseType = 'arraybuffer';

  console.log(xhr);

  xhr.onload = function(e) {
    var ab = new Uint8Array(this.response);
    console.log(ab);
    loadFromArrayBuffer(this.response);
  };

  xhr.send();

  //$.ajax({
  //  url: '/book/',
  //  type: "GET",
  //  dataType: "arraybuffer",
  //  success: function(data) {
  //    closeBook();
  //    console.log(data);
  //    loadFromArrayBuffer(data);
  //  }
  //});
}


function loadFromArrayBuffer(ab) {
  var start = (new Date).getTime();
  var h = new Uint8Array(ab, 0, 10);
  var pathToBitJS = '/static/bitjs/';
  if (h[0] == 0x52 && h[1] == 0x61 && h[2] == 0x72 && h[3] == 0x21) { //Rar!
    unarchiver = new bitjs.archive.Unrarrer(ab, pathToBitJS);
  } else if (h[0] == 80 && h[1] == 75) { //PK (Zip)
    unarchiver = new bitjs.archive.Unzipper(ab, pathToBitJS);
  } else { // Try with tar
    unarchiver = new bitjs.archive.Untarrer(ab, pathToBitJS);
  }
  // Listen for UnarchiveEvents.
  if (unarchiver) {
    unarchiver.addEventListener(bitjs.archive.UnarchiveEvent.Type.PROGRESS,
      function(e) {
        var percentage = e.currentBytesUnarchived / e.totalUncompressedBytesInArchive;
        totalImages = e.totalFilesInArchive;
        kthoom.setProgressMeter(percentage, 'Unzipping');
        // display nav
        lastCompletion = percentage * 100;         
      });
    unarchiver.addEventListener(bitjs.archive.UnarchiveEvent.Type.INFO,
      function(e) {
        console.log(e.msg);
      });
    unarchiver.addEventListener(bitjs.archive.UnarchiveEvent.Type.EXTRACT,
      function(e) {
        // convert DecompressedFile into a bunch of ImageFiles
        if (e.unarchivedFile) {
          var f = e.unarchivedFile;
          // add any new pages based on the filename
          if (imageFilenames.indexOf(f.filename) == -1) {
            imageFilenames.push(f.filename);
            imageFiles.push(new kthoom.ImageFile(f));
          }
        }
        
        // hide logo
        getElem('logo').setAttribute('style', 'display:none');

        // display first page if we haven't yet
        if (imageFiles.length == currentImage + 1) {
          updatePage();
        }            
      });
    unarchiver.addEventListener(bitjs.archive.UnarchiveEvent.Type.FINISH,
      function(e) {
        var diff = ((new Date).getTime() - start)/1000;
        console.log('Unarchiving done in ' + diff + 's');
      })
    unarchiver.start();
  } else {
    alert('Some error');
  }
}

function loadSingleBook(filename) {
  var fr = new FileReader();
  fr.onload = function() {
      var ab = fr.result;
      console.log(ab);
      loadFromArrayBuffer(ab);
  };
  fr.readAsArrayBuffer(filename);
}

var createURLFromArray = function(array, mimeType) {
  var offset = array.byteOffset, len = array.byteLength;
  var bb, url;
  var blob;

  // TODO: Move all this browser support testing to a common place
  //     and do it just once.

  // Blob constructor, see http://dev.w3.org/2006/webapi/FileAPI/#dfn-Blob.
  if (typeof Blob == 'function') {
    blob = new Blob([array], {type: mimeType});
  } else {
    throw 'Browser support for Blobs is missing.'
  }

  if (blob.slice) {
    blob = blob.slice(offset, offset + len, mimeType);
  } else {
    throw 'Browser support for Blobs is missing.'
  }

  if ((typeof URL != 'function' && typeof URL != 'object') ||
      typeof URL.createObjectURL != 'function') {
    throw 'Browser support for Object URLs is missing';
  }

  console.log("URL URL", URL.createObjectURL(blob), blob, array, mimeType);

  return URL.createObjectURL(blob);
}


function updatePage() {
  var title = getElem('page');
  while (title.firstChild) title.removeChild(title.firstChild);
  title.appendChild(document.createTextNode( (currentImage+1) + '/' + totalImages ));
  
  getElem('meter2').setAttribute('width',
      100 * (totalImages == 0 ? 0 : ((currentImage+1)/totalImages)) + '%');
  if (imageFiles[currentImage]) {
    setImage(imageFiles[currentImage].dataURI);
  } else {
    setImage('loading');
  }
}

function setImage(url) {
  var canvas = getElem('mainImage');
  var x = canvas.getContext('2d');
  document.getElementById('mainText').style.display = 'none';
  if (url == 'loading') {
    updateScale(true);
    canvas.width = innerWidth - 100;
    canvas.height = 200;
    x.fillStyle = 'red';
    x.font = '50px sans-serif';
    x.strokeStyle = 'black';
    x.fillText('Loading Page #' + (currentImage + 1), 100, 100)
  } else {
    if (document.body.scrollHeight/innerHeight > 1) {
      document.body.style.overflowY = 'scroll';
    }
    
    var img = new Image();
    img.onerror = function(e) {
      canvas.width = innerWidth - 100;
      canvas.height = 300;
      updateScale(true);
      x.fillStyle = 'orange';
      x.font = '50px sans-serif';
      x.strokeStyle = 'black';
      x.fillText('Page #' + (currentImage+1) + ' (' +
          imageFiles[currentImage].filename + ')', 100, 100)
      x.fillStyle = 'red';
      x.fillText('Is corrupt or not an image', 100, 200);
      
      if (/(html|htm)$/.test(imageFiles[currentImage].filename)) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onload = function() {
          document.getElementById('mainText').style.display = '';
          document.getElementById('mainText').innerHTML = '<iframe style="width:100%;height:700px;border:0" src="data:text/html,'+escape(xhr.responseText)+'"></iframe>';
        }
        xhr.send(null);
      } else if (!/(jpg|jpeg|png|gif)$/.test(imageFiles[currentImage].filename) && imageFiles[currentImage].data.uncompressedSize < 10*1024) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onload = function() {
          document.getElementById('mainText').style.display = '';
          document.getElementById('mainText').innerText = xhr.responseText;
        };
        xhr.send(null);
      }
    };
    img.onload = function() {
      var h = img.height, 
          w = img.width, 
          sw = w, 
          sh = h;
      kthoom.rotateTimes =  (4 + kthoom.rotateTimes) % 4;
      x.save();
      if (kthoom.rotateTimes % 2 == 1) { sh = w; sw = h;}
      canvas.height = sh;
      canvas.width = sw;
      x.translate(sw/2, sh/2);
      x.rotate(Math.PI/2 * kthoom.rotateTimes);
      x.translate(-w/2, -h/2);
      if (vflip) {
        x.scale(1, -1)
        x.translate(0, -h);
      }
      if (hflip) {
        x.scale(-1, 1)
        x.translate(-w, 0);
      }
      canvas.style.display = 'none';
      scrollTo(0,0);
      x.drawImage(img, 0, 0);
      
      updateScale();
        
      canvas.style.display = '';
      document.body.style.overflowY = '';
      x.restore();
    };
    img.src = url;
  };
}
// this doesn't seem to do anything
//function showPreview() {
//  console.log(/fullscreen/.test(getElem('header').className))
//  getElem('header').className += ' preview';
//  setTimeout(function() {
//    getElem('header').className += ' previewout';
//    setTimeout(function() {
//      getElem('header').className = getElem('header').className.replace(
//          /previewout|preview/g, '');
//    }, 1000);
//  }, 1337);
//}

function loadBook(bookNum) {
  if (bookNum >= 0 && bookNum < library.allBooks.length) {
    closeBook();
    library.currentBookNum = bookNum;
    loadSingleBook(library.allBooks[library.currentBookNum]);
  }
}

function loadPrevBook() {
  if (library.currentBookNum > 0) {
    loadBook(library.currentBookNum - 1);
  }
}

function loadNextBook() {
  if (library.currentBookNum < library.allBooks.length - 1) {
    loadBook(library.currentBookNum + 1);
  }
}

function showPrevPage() {
  currentImage--;

  if (currentImage < 0) {
    if (library.allBooks.length == 1) {
      currentImage = imageFiles.length - 1;
    } else if (library.currentBookNum > 0) {
      loadPrevBook();
    } else {
      // Freeze on the current page.
      currentImage++;
      return;
    }
  }

  updatePage();
  //showPreview();
  //getElem('prev').focus();
}

function showNextPage() {
  currentImage++;
  
  if (currentImage >= Math.max(totalImages, imageFiles.length)) {
    if (library.allBooks.length == 1) {
      currentImage = 0;
    } else if (library.currentBookNum < library.allBooks.length - 1) {
      loadNextBook();
    } else {
      // Freeze on the current page.
      currentImage--;
      return;
    }
  }

  updatePage();
  //showPreview();
  //getElem('next').focus();
}

function toggleToolbar() {
  //var headerDiv = getElem('header');

  $('#header').toggle();


  //console.log(headerDiv);

  //var fullscreen = /fullscreen/.test(headerDiv.className);
  //headerDiv.className = (fullscreen ? '' : 'fullscreen');
  //
  //console.log(headerDiv.className);

  //getElem('toolbarbutton).innerText = s?'-':'+';
  updateScale();
}

// Shows/hides the library.
function showLibrary(show) {
  var libraryDiv = getElem('library');
  libraryDiv.style.visibility = (show ? 'visible' : 'hidden');
}

// Opens/closes the library.
function toggleLibraryOpen() {
  var libraryDiv = getElem('library');
  var opened = /opened/.test(libraryDiv.className);
  libraryDiv.className = (opened ? '' : 'opened');
}

// Fills the library with the book names.
function updateLibrary() {
  var libDiv = getElem('libraryContents');
  // Clear out the library.
  libDiv.innerHTML = '';
  if (library.allBooks.length > 0) {
    for (var i = 0; i < library.allBooks.length; ++i) {
      var book = library.allBooks[i];
      var bookDiv = document.createElement('div');
      bookDiv.classList.add('libraryBook');
      if (library.currentBookNum == i) {
        bookDiv.classList.add('current');
      }
      bookDiv.dataset.index = i;
      bookDiv.innerHTML = book.name;
      bookDiv.addEventListener('click', function(evt) {
        // Trigger a re-render of the library.
        var index = parseInt(evt.target.dataset.index, 10);
        loadBook(index);
        updateLibrary();
      });
      libDiv.appendChild(bookDiv);
    }
  }
}

function closeBook() {
  // Terminate any async work the current unarchiver is doing.
  if (unarchiver) {
    unarchiver.stop();
    unarchiver = null;
  }
  currentImage = 0;
  imageFiles = [];
  imageFilenames = [];
  totalImages = 0;
  lastCompletion = 0;
  
  // display logo
  getElem('logo').setAttribute('style', 'display:block');
  
  getElem('nav').className = 'hide';
  getElem('progress').className = 'hide';
  
  getElem('meter').setAttribute('width', '0%');
  
  kthoom.setProgressMeter(0);
  updatePage();
}

function updateScale(clear) {
  var mainImageStyle = getElem('mainImage').style;
  mainImageStyle.width = '';
  mainImageStyle.height = '';
  mainImageStyle.maxWidth = '';
  mainImageStyle.maxHeight = '';
  var maxheight = innerHeight - 15;
  if (!/fullscreen/.test(getElem('header').className)) {
    maxheight -= 25;
  }
  if (clear || fitMode == kthoom.Key.N) {
  } else if (fitMode == kthoom.Key.B) {
    mainImageStyle.maxWidth = '100%';
    mainImageStyle.maxHeight = maxheight + 'px';
  } else if (fitMode == kthoom.Key.H) {
    mainImageStyle.height = maxheight + 'px';
  } else if (fitMode == kthoom.Key.W) {
    mainImageStyle.width = '100%';
  }
  kthoom.saveSettings();
}

function keyHandler(evt) {
  var code = evt.keyCode;

  // If the overlay is shown, the only keystroke we handle is closing it.
  var overlayStyle = getElem('overlay').style;
  var overlayShown = (overlayStyle.display != 'none');
  if (overlayShown) {
    if (code == kthoom.Key.QUESTION_MARK || code == kthoom.Key.ESCAPE) {
      getElem('menu').classList.remove('opened');
      overlayStyle.display = 'none';
    }
    return;
  }

  // Handle keystrokes that do not depend on whether a document is loaded.
  if (code == kthoom.Key.O) {
    getElem('menu-open-local-files-input').click();
    getElem('menu').classList.remove('opened');
  } else if (code == kthoom.Key.QUESTION_MARK) {
    overlayStyle.display = 'block';
  }

  if (getComputedStyle(getElem('progress')).display == 'none') return;
  canKeyNext = ((document.body.offsetWidth+document.body.scrollLeft)/ document.body.scrollWidth) >= 1;
  canKeyPrev = (scrollX <= 0);

  if (evt.ctrlKey || evt.shiftKey || evt.metaKey) return;
  switch(code) {
    case kthoom.Key.X:
      toggleToolbar();
      break;
    case kthoom.Key.LEFT:
      if (canKeyPrev) showPrevPage();
      break;
    case kthoom.Key.RIGHT:
      if (canKeyNext) showNextPage();
      break;
    case kthoom.Key.LEFT_SQUARE_BRACKET:
      if (library.currentBookNum > 0) {
        loadPrevBook();
      }
      break;
    case kthoom.Key.RIGHT_SQUARE_BRACKET:
      if (library.currentBookNum < library.allBooks.length - 1) {
        loadNextBook();
      }
      break;
    case kthoom.Key.L:
      kthoom.rotateTimes--;
      if (kthoom.rotateTimes < 0) {
        kthoom.rotateTimes = 3;
      }
      updatePage();
      break;
    case kthoom.Key.R:
      kthoom.rotateTimes++;
      if (kthoom.rotateTimes > 3) {
        kthoom.rotateTimes = 0;
      }
      updatePage();
      break;
    case kthoom.Key.F:
      if (!hflip && !vflip) {
        hflip = true;
      } else if(hflip == true) {
        vflip = true;
        hflip = false;
      } else if(vflip == true) {
        vflip = false;
      }
      updatePage();
      break;
    case kthoom.Key.W:
      fitMode = kthoom.Key.W;
      updateScale();
      break;
    case kthoom.Key.H:
      fitMode = kthoom.Key.H;
      updateScale();
      break;
    case kthoom.Key.B:
      fitMode = kthoom.Key.B;
      updateScale();
      break;
    case kthoom.Key.N:
      fitMode = kthoom.Key.N;
      updateScale();
      break;
    default:
      //console.log('KeyCode = ' + code);
      break;
  }
}

function init() {
  if (!window.FileReader) {
    alert('Sorry, kthoom will not work with your browser because it does not support the File API.  Please try kthoom with Chrome 12+ or Firefox 7+');
  } else {
    kthoom.initProgressMeter();
    document.body.className += /AppleWebKit/.test(navigator.userAgent) ? ' webkit' : '';
    kthoom.resetFileUploader();
    kthoom.loadSettings();
    document.addEventListener('keydown', keyHandler, false);
    window.addEventListener('resize', function() {
      var f = (screen.width - innerWidth < 4 && screen.height - innerHeight < 4);
      getElem('header').className = f ? 'fullscreen' : '';
      updateScale();
    }, false);
    getElem('mainImage').addEventListener('click', function(evt) {
      // Firefox does not support offsetX/Y so we have to manually calculate
      // where the user clicked in the image.
      var mainContentWidth = getElem('mainContent').clientWidth;
      var mainContentHeight = getElem('mainContent').clientHeight;
      var comicWidth = evt.target.clientWidth;
      var comicHeight = evt.target.clientHeight;
      var offsetX = (mainContentWidth - comicWidth) / 2;
      var offsetY = (mainContentHeight - comicHeight) / 2;
      var clickX = !!evt.offsetX ? evt.offsetX : (evt.clientX - offsetX);
      var clickY = !!evt.offsetY ? evt.offsetY : (evt.clientY - offsetY);

      // Determine if the user clicked/tapped the left side or the
      // right side of the page.
      var clickedPrev = false;
      switch (kthoom.rotateTimes) {
        case 0:
          clickedPrev = clickX < (comicWidth / 2);
          break;
        case 1:
          clickedPrev = clickY < (comicHeight / 2);
          break;
        case 2:
          clickedPrev = clickX > (comicWidth / 2);
          break;
        case 3:
          clickedPrev = clickY > (comicHeight / 2);
          break;
      }
      if (clickedPrev) {
        showPrevPage();
      } else {
        showNextPage();
      }
    }, false);
    getElem('libraryTab').addEventListener('click', function() {
      toggleLibraryOpen();
    }, false);
  }
}

// Do html5 drag and drop.
document.addEventListener('dragenter', function(e){e.preventDefault();e.stopPropagation()}, false);
document.addEventListener('dragexit', function(e){e.preventDefault();e.stopPropagation()}, false);
document.addEventListener('dragover', function(e){e.preventDefault();e.stopPropagation()}, false);
document.addEventListener('drop', function(e){
  e.preventDefault();
  e.stopPropagation();
  getLocalFiles({target:e.dataTransfer});
}, false);
