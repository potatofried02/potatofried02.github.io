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
      var a = document.createElement("a");
      a.className = "notes-link" + (idx === 0 ? " active" : "");
      a.href = "#";
      a.textContent = item.title || titleFromLocation(item.location);
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

  filterInput.addEventListener("input", applyFilter);

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
          item._searchBlob = (item.title + " " + item.location + " " + item.text).toLowerCase();
          return item;
        })
        .sort(function (a, b) {
        return b.location.localeCompare(a.location);
      });
      render(allItems);
    })
    .catch(function () {
      render([]);
    });
});
