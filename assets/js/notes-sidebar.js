document.addEventListener("DOMContentLoaded", function () {
  var listEl = document.getElementById("notes-auto-list");
  var contentEl = document.getElementById("notes-content");
  var filterInput = document.getElementById("notes-filter-input");
  if (!listEl || !contentEl || !filterInput) return;

  function getAbsoluteUrl(loc) {
    // 去掉开头的 /（如果有），避免双斜杠
    var cleanLoc = String(loc || "").replace(/^\/+/, "");
    // 如果 base 是 "." 或者空，我们需要算一个基于网站根目录的绝对路径，
    // 因为在 GitHub Pages 根目录下，window.base_url 在 notes/index.html 里是 ".."
    var rootBase = window.base_url || ".";
    var prefix = rootBase.replace(/\/$/, "");
    return prefix + "/" + cleanLoc;
  }

  var indexPath = getAbsoluteUrl("search/search_index.json");

  function titleFromLocation(loc) {
    var s = String(loc || "")
      .replace(/^notes\//, "")
      .replace(/\/$/, "")
      .replace(/-/g, " ");
    return s || "Untitled";
  }

  function decodePathSegment(seg) {
    if (!seg) {
      return seg;
    }
    try {
      return decodeURIComponent(seg);
    } catch (e) {
      return seg;
    }
  }

  /**
   * MkDocs 索引里的 location 可能对中文路径分段做了 URL 编码，需解码后再解析标题/TAG。
   * 请求页面时仍使用原始 location 字符串（与静态文件路径一致）。
   */
  function parseNoteLocation(loc) {
    var path = String(loc || "").replace(/\/$/, "");
    var parts = path.split("/").map(decodePathSegment);
    var file = parts[parts.length - 1] || "";
    // 索引里常见两种：xxx-YYYY-MM-DD.md 或 MkDocs 用的目录 URL 最后一段 xxx-YYYY-MM-DD（无 .md）
    var m = file.match(/^(.+)-(\d{4}-\d{2}-\d{2})(\.md)?$/i);
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
      if (seg && seg !== "posts") {
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

    function loadNote(location, meta) {
      // 在静态服务器中，如果 location 是目录，fetch 可能不会自动补充 index.html
      var fetchUrl = getAbsoluteUrl(location);
      if (!fetchUrl.endsWith(".html")) {
        if (!fetchUrl.endsWith("/")) {
          fetchUrl += "/";
        }
        fetchUrl += "index.html";
      }

      // 将 URL 里的百分号编码解码为原文，防止某些服务器 404
      try {
        fetchUrl = decodeURI(fetchUrl);
      } catch (e) {
        // ignore
      }

      fetch(fetchUrl)
        .then(function (res) {
          if (!res.ok) throw new Error("note load failed: " + res.status + " for " + fetchUrl);
          return res.text();
        })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, "text/html");
          var main = doc.querySelector(".col-md-9[role='main']");
          if (!main) throw new Error("note main not found in " + fetchUrl);

          // Fix relative image paths because content is displayed in /notes/ instead of its own folder
          // The base for these images should be the folder of the note itself
          var noteBaseUrl = fetchUrl.substring(0, fetchUrl.lastIndexOf("/") + 1);
          main.querySelectorAll("img").forEach(function (img) {
            var src = img.getAttribute("src");
            // If it's a relative path (not starting with http, /, data:, etc.)
            if (src && !src.match(/^(https?:|\/|data:)/)) {
              // Create an absolute URL string combining noteBaseUrl and the relative src
              // This relies on the browser's URL parser to resolve ../ and ./ correctly
              try {
                // If base is a fully qualified URL
                img.src = new URL(src, new URL(noteBaseUrl, window.location.href)).href;
              } catch(e) {
                // Fallback for very old browsers, just append
                img.src = noteBaseUrl + src;
              }
            }
          });

          contentEl.innerHTML = "";
          var metaRow = document.createElement("div");
          metaRow.className = "notes-article-meta";
          var bits = [];
          if (meta.date) {
            bits.push(meta.date);
          }
          if (meta.tags && meta.tags.length) {
            bits.push("TAG: " + meta.tags.join(" · "));
          }
          if (bits.length) {
            metaRow.textContent = bits.join("  ·  ");
            contentEl.appendChild(metaRow);
          }
          var bodyWrap = document.createElement("div");
          bodyWrap.className = "notes-article-body";
          bodyWrap.innerHTML = main.innerHTML;
          contentEl.appendChild(bodyWrap);
        })
        .catch(function (e) {
          contentEl.innerHTML = '<div class="notes-hint">Not found.<br><br><small style="color:#a87445;">Debug info: ' + e.message + '</small></div>';
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
      a.appendChild(titleSpan);
      a.addEventListener("click", function (e) {
        e.preventDefault();
        listEl.querySelectorAll(".notes-link").forEach(function (x) {
          x.classList.remove("active");
        });
        a.classList.add("active");
        
        // 更新 URL 里的 Hash (去掉 notes/，因为外层已经是 notes/ 了，保持链接干净)
        var hashPath = item.location.replace(/^notes\//, "");
        history.replaceState(null, "", "#" + hashPath);

        loadNote(item.location, meta);
      });
      listEl.appendChild(a);
    });

    // Default show first note or the one from the URL Hash
    var targetLocation = items[0].location;
    var targetMeta = items[0]._meta || parseNoteLocation(targetLocation);

    if (window.location.hash) {
      // 提取 hash 中的路径（去掉开头的 #），由于 hash 里的中文往往是 URL 编码的，解码一次以利于匹配
      var hashParam = decodeURIComponent(window.location.hash.substring(1));
      // 循环对比 items 里的 location，看哪个的结尾包含了 hashParam
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.location.endsWith(hashParam) || it.location === "notes/" + hashParam) {
          targetLocation = it.location;
          targetMeta = it._meta || parseNoteLocation(targetLocation);
          
          // 给左侧边栏高亮这一个选中的
          var matchedLink = listEl.children[i];
          if (matchedLink) {
             listEl.querySelectorAll(".notes-link").forEach(function(x) { x.classList.remove("active"); });
             matchedLink.classList.add("active");
          }
          break;
        }
      }
    }

    loadNote(targetLocation, targetMeta);
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
            (item.title || "") +
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
