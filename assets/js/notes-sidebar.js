document.addEventListener("DOMContentLoaded", function () {
  var listEl = document.getElementById("notes-auto-list");
  var contentEl = document.getElementById("notes-content");
  var filterInput = document.getElementById("notes-filter-input");
  if (!listEl || !contentEl || !filterInput) return;

  var base = (window.base_url || ".").replace(/\/$/, "");
  var indexPath = base + "/search/search_index.json";

  function titleFromLocation(loc) {
    var s = String(loc || "")
      .replace(/^notes\//, "")
      .replace(/\/$/, "")
      .replace(/-/g, " ");
    return s || "Untitled";
  }

  /**
   * 文件名约定：{任意标题}-YYYY-MM-DD.md（日期在末尾、扩展名前）
   * 子目录名作为 TAG（不含保留段 _sync）
   */
  function parseNoteLocation(loc) {
    var path = String(loc || "").replace(/\/$/, "");
    var parts = path.split("/");
    var file = parts[parts.length - 1] || "";
    var m = file.match(/^(.+)-(\d{4}-\d{2}-\d{2})\.md$/i);
    var title;
    var dateStr = "";
    if (m) {
      title = m[1];
      dateStr = m[2];
    } else {
      title = file.replace(/\.md$/i, "").replace(/-/g, " ");
    }
    var tags = [];
    for (var i = 1; i < parts.length - 1; i++) {
      var seg = parts[i];
      if (seg && seg !== "_sync") {
        tags.push(seg);
      }
    }
    return { title: title || "Untitled", date: dateStr, tags: tags };
  }

  var allItems = [];

  function render(items) {
    listEl.innerHTML = "";
    if (!items.length) {
      var empty = document.createElement("div");
      empty.className = "notes-hint";
      empty.textContent = "No notes found.";
      listEl.appendChild(empty);
      contentEl.innerHTML = '<div class="notes-hint">Not found.</div>';
      return;
    }

    function loadNote(location) {
      fetch(base + "/" + location)
        .then(function (res) {
          if (!res.ok) throw new Error("note load failed");
          return res.text();
        })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, "text/html");
          var main = doc.querySelector(".col-md-9[role='main']");
          if (!main) throw new Error("note main not found");
          contentEl.innerHTML = main.innerHTML;
        })
        .catch(function () {
          contentEl.innerHTML = '<div class="notes-hint">Not found.</div>';
        });
    }

    items.forEach(function (item, idx) {
      var meta = item._meta || parseNoteLocation(item.location);
      var a = document.createElement("a");
      a.className = "notes-link" + (idx === 0 ? " active" : "");
      a.href = "#";
      var titleSpan = document.createElement("span");
      titleSpan.className = "notes-link-title";
      titleSpan.textContent = meta.title;
      var metaLine = document.createElement("span");
      metaLine.className = "notes-link-meta";
      var metaBits = [];
      if (meta.date) {
        metaBits.push(meta.date);
      }
      meta.tags.forEach(function (t) {
        metaBits.push(t);
      });
      metaLine.textContent = metaBits.join(" · ");
      a.appendChild(titleSpan);
      if (metaBits.length) {
        a.appendChild(metaLine);
      }
      a.addEventListener("click", function (e) {
        e.preventDefault();
        listEl.querySelectorAll(".notes-link").forEach(function (x) {
          x.classList.remove("active");
        });
        a.classList.add("active");
        loadNote(item.location);
      });
      listEl.appendChild(a);
    });

    // Default show first note.
    loadNote(items[0].location);
  }

  function applyFilter() {
    var q = (filterInput.value || "").trim().toLowerCase();
    if (!q) {
      render(allItems);
      return;
    }
    var filtered = allItems.filter(function (item) {
      return item._searchBlob.includes(q);
    });
    render(filtered);
  }

  var FILTER_DEBOUNCE_MS = 120;
  var filterTimer = null;
  filterInput.addEventListener("input", function () {
    if (filterTimer) {
      clearTimeout(filterTimer);
      filterTimer = null;
    }
    var raw = (filterInput.value || "").trim();
    if (!raw) {
      applyFilter();
      return;
    }
    filterTimer = setTimeout(function () {
      filterTimer = null;
      applyFilter();
    }, FILTER_DEBOUNCE_MS);
  });

  fetch(indexPath)
    .then(function (res) {
      if (!res.ok) throw new Error("search index unavailable");
      return res.json();
    })
    .then(function (payload) {
      var docs = Array.isArray(payload.docs) ? payload.docs : [];
      var uniq = new Map();
      docs.forEach(function (d) {
        var loc = String(d.location || "");
        // Only keep notes page entries; skip notes home and section anchors.
        if (!loc.startsWith("notes/")) return;
        if (loc === "notes/" || loc.includes("#")) return;
        if (loc === "notes/index.md") return;
        if (!uniq.has(loc)) {
          uniq.set(loc, {
            location: loc,
            title: d.title || "",
            text: d.text || "",
          });
        } else {
          var prev = uniq.get(loc);
          if (!prev.title && d.title) prev.title = d.title;
          if (d.text) prev.text += " " + d.text;
        }
      });
      allItems = Array.from(uniq.values())
        .map(function (item) {
          item._meta = parseNoteLocation(item.location);
          var m = item._meta;
          item._dateParsed = m.date
            ? new Date(m.date + "T00:00:00").getTime()
            : 0;
          item._searchBlob = (
            m.title +
            " " +
            m.date +
            " " +
            m.tags.join(" ") +
            " " +
            item.title +
            " " +
            item.location +
            " " +
            item.text
          ).toLowerCase();
          return item;
        })
        .sort(function (a, b) {
          if (a._dateParsed !== b._dateParsed) {
            return b._dateParsed - a._dateParsed;
          }
          return b.location.localeCompare(a.location);
        });
      render(allItems);
    })
    .catch(function () {
      render([]);
    });
});
