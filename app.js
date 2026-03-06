// =============================================
// REPLACE THIS URL WITH YOUR GOOGLE SHEET CSV URL
var SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/YOUR-SHEET-ID-HERE/pub?gid=0&single=true&output=csv';
// =============================================

var REFRESH_INTERVAL = 3 * 60 * 1000;   // Refresh data every 3 minutes
var INACTIVITY_TIMEOUT = 2 * 60 * 1000; // Reset to top after 2 min inactivity
var CACHE_KEY = 'winelist-data';
var CURRENCY = '$';

var inactivityTimer;
var allWines = [];
var sections = [];
var sectionMap = {};

// ---- CSV Parser ----

function parseCSV(text) {
  var lines = text.split('\n');
  if (lines.length < 2) return [];
  var headers = parseCSVLine(lines[0]);
  var wines = [];
  for (var i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    var values = parseCSVLine(lines[i]);
    var wine = {};
    var isEmpty = true;
    for (var j = 0; j < headers.length; j++) {
      var val = (values[j] || '').trim();
      wine[headers[j].trim()] = val;
      if (val && headers[j].trim() === 'Section') isEmpty = false;
    }
    if (!isEmpty) wines.push(wine);
  }
  return wines;
}

function parseCSVLine(line) {
  var result = [];
  var current = '';
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

// ---- Data Fetching ----

function fetchWines(callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', SHEET_CSV_URL, true);
  xhr.onload = function () {
    if (xhr.status >= 200 && xhr.status < 300) {
      var wines = parseCSV(xhr.responseText);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ wines: wines, timestamp: Date.now() }));
      } catch (e) { /* storage full or unavailable */ }
      callback(wines);
    } else {
      callback(loadFromCache());
    }
  };
  xhr.onerror = function () {
    callback(loadFromCache());
  };
  xhr.send();
}

function loadFromCache() {
  try {
    var cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      var data = JSON.parse(cached);
      return data.wines;
    }
  } catch (e) { }
  return null;
}

// ---- Rendering ----

function renderWineList(wines) {
  var main = document.getElementById('wine-list');
  var nav = document.getElementById('section-nav');

  if (!wines || wines.length === 0) {
    main.innerHTML = '<p class="error">No wines available. Please check the spreadsheet.</p>';
    nav.innerHTML = '';
    return;
  }

  // Filter to only visible wines (status = yes)
  var available = [];
  for (var i = 0; i < wines.length; i++) {
    if ((wines[i]['Status'] || '').toLowerCase() === 'yes') {
      available.push(wines[i]);
    }
  }

  allWines = available;

  // Group by section, preserving spreadsheet order
  sections = [];
  sectionMap = {};
  for (var i = 0; i < available.length; i++) {
    var section = available[i]['Section'] || 'Other';
    if (!sectionMap[section]) {
      sectionMap[section] = [];
      sections.push(section);
    }
    sectionMap[section].push(available[i]);
  }

  // Build nav
  buildNav(sections);

  // Build wine list
  var html = '';
  for (var s = 0; s < sections.length; s++) {
    var section = sections[s];
    var sectionWines = sectionMap[section];
    html += '<div class="section-block" id="section-' + slugify(section) + '">';
    html += '<h2 class="section-title">' + escapeHTML(section) + '</h2>';

    // Check if this section has sub-sections
    var hasSubSections = false;
    for (var w = 0; w < sectionWines.length; w++) {
      if (sectionWines[w]['Sub-Section']) { hasSubSections = true; break; }
    }

    if (hasSubSections) {
      // Group by sub-section, preserving order
      var subSections = [];
      var subMap = {};
      for (var w = 0; w < sectionWines.length; w++) {
        var sub = sectionWines[w]['Sub-Section'] || 'Other';
        if (!subMap[sub]) {
          subMap[sub] = [];
          subSections.push(sub);
        }
        subMap[sub].push(sectionWines[w]);
      }
      for (var ss = 0; ss < subSections.length; ss++) {
        html += '<h3 class="sub-section-title">' + escapeHTML(subSections[ss]) + '</h3>';
        for (var w = 0; w < subMap[subSections[ss]].length; w++) {
          html += renderWineRow(subMap[subSections[ss]][w]);
        }
      }
    } else {
      for (var w = 0; w < sectionWines.length; w++) {
        html += renderWineRow(sectionWines[w]);
      }
    }

    html += '</div>';
  }

  main.innerHTML = html;
  updateTimestamp();
}

function renderWineRow(wine) {
  var name = wine['Wine Name'] || '';
  var bin = wine['Bin No.'] ? 'Bin ' + wine['Bin No.'] : '';
  var vintage = wine['Vintage'] || '';
  var description = wine['Description'] || '';
  var details = [];
  if (bin) details.push(bin);
  if (vintage) details.push(vintage);
  var detailStr = details.join(' \u00B7 ');

  var priceHTML = '';
  var glass = wine['Glass Price'];
  var half = wine['Half Bottle Price'];
  var bottle = wine['Bottle Price'];

  if (glass) {
    priceHTML += '<div class="price-group"><span class="price-value">' + CURRENCY + formatPrice(glass) + '</span><span class="price-label">glass</span></div>';
  }
  if (half) {
    priceHTML += '<div class="price-group"><span class="price-value">' + CURRENCY + formatPrice(half) + '</span><span class="price-label">half</span></div>';
  }
  if (bottle) {
    priceHTML += '<div class="price-group"><span class="price-value">' + CURRENCY + formatPrice(bottle) + '</span><span class="price-label">bottle</span></div>';
  }

  var html = '<div class="wine-row" data-name="' + escapeAttr(name.toLowerCase()) + '" data-section="' + escapeAttr((wine['Section'] || '').toLowerCase()) + '">';
  html += '<div class="wine-info">';
  html += '<div class="wine-name">' + escapeHTML(name) + '</div>';
  if (detailStr) html += '<div class="wine-details">' + escapeHTML(detailStr) + '</div>';
  if (description) html += '<div class="wine-description">' + escapeHTML(description) + '</div>';
  html += '</div>';
  if (priceHTML) html += '<div class="wine-prices">' + priceHTML + '</div>';
  html += '</div>';
  return html;
}

function formatPrice(price) {
  var num = parseFloat(price);
  if (isNaN(num)) return price;
  return num.toFixed(2);
}

// ---- Navigation ----

function buildNav(sections) {
  var nav = document.getElementById('section-nav');
  nav.innerHTML = '';

  // Toggle button
  var toggle = document.createElement('button');
  toggle.id = 'nav-toggle';
  toggle.innerHTML = '<span class="toggle-arrow">\u25C0</span>';
  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    nav.classList.toggle('expanded');
  });
  nav.appendChild(toggle);

  // Close nav when tapping outside
  document.addEventListener('click', function (e) {
    if (!nav.contains(e.target) && nav.classList.contains('expanded')) {
      nav.classList.remove('expanded');
    }
  });

  for (var i = 0; i < sections.length; i++) {
    var section = sections[i];
    var btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.setAttribute('data-section', slugify(section));

    var dot = document.createElement('span');
    dot.className = 'nav-dot';

    var label = document.createElement('span');
    label.className = 'nav-label';
    label.textContent = section;

    btn.appendChild(dot);
    btn.appendChild(label);

    btn.addEventListener('click', (function (sec) {
      return function () {
        var el = document.getElementById('section-' + slugify(sec));
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        nav.classList.remove('expanded');
      };
    })(section));
    nav.appendChild(btn);
  }

  // Highlight active section on scroll
  setupScrollSpy();
}

function setupScrollSpy() {
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(function () {
        highlightActiveSection();
        ticking = false;
      });
      ticking = true;
    }
  });
}

function highlightActiveSection() {
  var blocks = document.querySelectorAll('.section-block');
  var navButtons = document.querySelectorAll('#section-nav .nav-btn');
  var scrollPos = window.scrollY + 120;
  var activeId = '';

  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i].offsetTop <= scrollPos) {
      activeId = blocks[i].id;
    }
  }

  for (var i = 0; i < navButtons.length; i++) {
    if ('section-' + navButtons[i].getAttribute('data-section') === activeId) {
      navButtons[i].classList.add('active');
    } else {
      navButtons[i].classList.remove('active');
    }
  }
}

// ---- Search ----

function setupSearch() {
  var input = document.getElementById('search-input');
  var clearBtn = document.getElementById('search-clear');

  input.addEventListener('input', function () {
    var query = input.value.trim().toLowerCase();
    clearBtn.classList.toggle('visible', query.length > 0);
    filterWines(query);
  });

  clearBtn.addEventListener('click', function () {
    input.value = '';
    clearBtn.classList.remove('visible');
    filterWines('');
    input.focus();
  });
}

function filterWines(query) {
  var rows = document.querySelectorAll('.wine-row');
  var sectionBlocks = document.querySelectorAll('.section-block');
  var subHeaders = document.querySelectorAll('.sub-section-title');
  var noResults = document.querySelector('.no-results');
  if (noResults) noResults.remove();

  if (!query) {
    // Show everything
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.remove('search-hidden', 'search-match');
    }
    for (var i = 0; i < sectionBlocks.length; i++) {
      sectionBlocks[i].classList.remove('search-hidden');
    }
    for (var i = 0; i < subHeaders.length; i++) {
      subHeaders[i].classList.remove('search-hidden');
    }
    return;
  }

  var anyMatch = false;

  // Hide/show wine rows
  for (var i = 0; i < rows.length; i++) {
    var name = rows[i].getAttribute('data-name') || '';
    if (name.indexOf(query) !== -1) {
      rows[i].classList.remove('search-hidden');
      rows[i].classList.add('search-match');
      anyMatch = true;
    } else {
      rows[i].classList.add('search-hidden');
      rows[i].classList.remove('search-match');
    }
  }

  // Hide sections with no visible wines
  for (var i = 0; i < sectionBlocks.length; i++) {
    var visibleWines = sectionBlocks[i].querySelectorAll('.wine-row:not(.search-hidden)');
    if (visibleWines.length === 0) {
      sectionBlocks[i].classList.add('search-hidden');
    } else {
      sectionBlocks[i].classList.remove('search-hidden');
    }
  }

  // Hide sub-section headers with no visible wines after them
  for (var i = 0; i < subHeaders.length; i++) {
    var nextEl = subHeaders[i].nextElementSibling;
    var hasVisible = false;
    while (nextEl && !nextEl.classList.contains('sub-section-title') && !nextEl.classList.contains('section-title')) {
      if (nextEl.classList.contains('wine-row') && !nextEl.classList.contains('search-hidden')) {
        hasVisible = true;
        break;
      }
      nextEl = nextEl.nextElementSibling;
    }
    if (hasVisible) {
      subHeaders[i].classList.remove('search-hidden');
    } else {
      subHeaders[i].classList.add('search-hidden');
    }
  }

  if (!anyMatch) {
    var msg = document.createElement('p');
    msg.className = 'no-results';
    msg.textContent = 'No wines found for "' + document.getElementById('search-input').value + '"';
    document.getElementById('wine-list').appendChild(msg);
  }
}

// ---- Inactivity Reset ----

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  var overlay = document.getElementById('reset-overlay');
  overlay.classList.remove('visible');

  inactivityTimer = setTimeout(function () {
    // Clear search
    var input = document.getElementById('search-input');
    input.value = '';
    document.getElementById('search-clear').classList.remove('visible');
    filterWines('');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Remove active nav states and collapse nav
    var navButtons = document.querySelectorAll('#section-nav .nav-btn');
    for (var i = 0; i < navButtons.length; i++) {
      navButtons[i].classList.remove('active');
    }
    document.getElementById('section-nav').classList.remove('expanded');

    // Show overlay
    setTimeout(function () {
      overlay.classList.add('visible');
    }, 400);
  }, INACTIVITY_TIMEOUT);
}

function setupInactivity() {
  var overlay = document.getElementById('reset-overlay');
  overlay.addEventListener('click', function () {
    overlay.classList.remove('visible');
    resetInactivityTimer();
  });

  var events = ['touchstart', 'click', 'scroll'];
  for (var i = 0; i < events.length; i++) {
    document.addEventListener(events[i], resetInactivityTimer);
  }
  resetInactivityTimer();
}

// ---- Timestamp ----

function updateTimestamp() {
  var el = document.getElementById('last-updated');
  try {
    var cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      var data = JSON.parse(cached);
      var date = new Date(data.timestamp);
      el.textContent = 'Last updated: ' + date.toLocaleString();
    }
  } catch (e) { }
}

// ---- Utilities ----

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function escapeHTML(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---- Service Worker Registration ----

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(function (err) {
    // SW registration failed — site still works, just no offline caching
  });
}

// ---- Init ----

function init() {
  setupSearch();

  fetchWines(function (wines) {
    if (wines) {
      renderWineList(wines);
    } else {
      document.getElementById('wine-list').innerHTML =
        '<p class="error">Unable to load wine list. Please check WiFi connection.</p>';
    }
  });

  // Auto-refresh
  setInterval(function () {
    fetchWines(function (wines) {
      if (wines) renderWineList(wines);
    });
  }, REFRESH_INTERVAL);

  setupInactivity();
}

init();
