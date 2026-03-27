document.addEventListener("DOMContentLoaded", function () {
  var rightNav = document.querySelector(".navbar .ms-md-auto");
  if (!rightNav) return;

  // Remove built-in modal search entry and prev/next links.
  rightNav.querySelectorAll('a[data-bs-target="#mkdocs_search_modal"], a[rel="prev"], a[rel="next"]').forEach(function (a) {
    var li = a.closest("li");
    if (li) li.remove();
  });

  // Remove modal itself so it never appears.
  var modal = document.getElementById("mkdocs_search_modal");
  if (modal) modal.remove();
});
