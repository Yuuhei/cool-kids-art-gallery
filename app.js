const state = {
  all: [],
  search: "",
  tag: null,
  favoritesOnly: false,
};

const wall = document.getElementById("wall");
const emptyState = document.getElementById("empty-state");
const emptyStateSub = document.getElementById("empty-state-sub");
const searchInput = document.getElementById("search");
const tagRail = document.getElementById("tag-rail");
const favToggle = document.getElementById("fav-toggle");

function getFavorites() {
  return new Set(JSON.parse(localStorage.getItem("gallery_favorites") || "[]"));
}

function saveFavorites(set) {
  localStorage.setItem("gallery_favorites", JSON.stringify([...set]));
}

function toggleFavorite(id) {
  const favs = getFavorites();
  if (favs.has(id)) favs.delete(id);
  else favs.add(id);
  saveFavorites(favs);
  return favs.has(id);
}

async function init() {
  let data;
  try {
    const res = await fetch("artworks.json", { cache: "no-store" });
    data = await res.json();
  } catch (e) {
    data = { gallery_name: "The Gallery", artworks: [] };
  }

  if (data.gallery_name) {
    document.title = data.gallery_name;
    document.getElementById("wordmark").textContent = data.gallery_name;
  }

  state.all = data.artworks || [];
  buildTagRail();
  render();
}

function buildTagRail() {
  const counts = {};
  for (const item of state.all) {
    for (const t of item.tags || []) {
      counts[t] = (counts[t] || 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 24);

  tagRail.innerHTML = "";
  const allChip = makeChip("All", null);
  allChip.classList.add("is-active");
  tagRail.appendChild(allChip);

  for (const [tag, count] of sorted) {
    tagRail.appendChild(makeChip(`${tag} · ${count}`, tag));
  }
}

function makeChip(label, tagValue) {
  const btn = document.createElement("button");
  btn.className = "tag-chip";
  btn.textContent = label;
  btn.addEventListener("click", () => {
    state.tag = tagValue;
    [...tagRail.children].forEach(c => c.classList.remove("is-active"));
    btn.classList.add("is-active");
    render();
  });
  return btn;
}

function matches(item) {
  if (state.favoritesOnly && !getFavorites().has(item.id)) return false;
  if (state.tag && !(item.tags || []).includes(state.tag)) return false;
  if (state.search) {
    const q = state.search.toLowerCase();
    const haystack = [item.username, item.caption, ...(item.tags || [])]
      .filter(Boolean).join(" ").toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function render() {
  const items = state.all.filter(matches);
  wall.innerHTML = "";

  if (items.length === 0) {
    emptyState.hidden = false;
    emptyStateSub.textContent = state.favoritesOnly
      ? "Nothing saved yet — open a piece and tap Save."
      : "Post artwork in the Discord art channel and it'll show up here.";
  } else {
    emptyState.hidden = true;
  }

  for (const item of items) {
    wall.appendChild(renderPiece(item));
  }
}

function renderPiece(item) {
  const isFav = getFavorites().has(item.id);
  const el = document.createElement("article");
  el.className = "piece";
  const tags = item.tags || [];

  el.innerHTML = `
    <div class="piece-frame">
      <img src="images/${item.image_filename}" alt="${escapeHtml(item.caption || 'Untitled artwork')}" loading="lazy" />
      <span class="piece-saved-mark ${isFav ? "is-visible" : ""}">&hearts;</span>
    </div>
    <div class="piece-label">
      <p class="piece-artist">${escapeHtml(item.username)}</p>
      ${tags.length ? `<p class="piece-meta">${escapeHtml(tags[0])}</p>` : ""}
    </div>
  `;

  el.addEventListener("click", () => openLightbox(item));
  return el;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/* ---------- lightbox ---------- */

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxArtist = document.getElementById("lightbox-artist");
const lightboxCaption = document.getElementById("lightbox-caption");
const lightboxTags = document.getElementById("lightbox-tags");
const lightboxLike = document.getElementById("lightbox-like");
const lightboxLikeLabel = document.getElementById("lightbox-like-label");
const lightboxSource = document.getElementById("lightbox-source");

let currentItem = null;

function openLightbox(item) {
  currentItem = item;
  lightboxImage.src = `images/${item.image_filename}`;
  lightboxImage.alt = item.caption || "Artwork";
  lightboxArtist.textContent = item.username;
  lightboxCaption.textContent = item.caption || "";
  lightboxCaption.hidden = !item.caption;
  lightboxSource.href = item.message_link || "#";

  lightboxTags.innerHTML = "";
  (item.tags || []).forEach(t => {
    const span = document.createElement("span");
    span.textContent = t;
    lightboxTags.appendChild(span);
  });

  updateLikeButton(item);
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = "";
  currentItem = null;
  render(); // reflect any favorite changes on the wall
}

function updateLikeButton(item) {
  const isFav = getFavorites().has(item.id);
  lightboxLike.classList.toggle("is-liked", isFav);
  lightboxLikeLabel.textContent = isFav ? "Saved" : "Save";
}

lightboxLike.addEventListener("click", () => {
  if (!currentItem) return;
  toggleFavorite(currentItem.id);
  updateLikeButton(currentItem);
});

document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
document.getElementById("lightbox-backdrop").addEventListener("click", closeLightbox);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !lightbox.hidden) closeLightbox();
});

/* ---------- controls ---------- */

let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = searchInput.value.trim();
    render();
  }, 200);
});

favToggle.addEventListener("click", () => {
  state.favoritesOnly = !state.favoritesOnly;
  favToggle.setAttribute("aria-pressed", String(state.favoritesOnly));
  render();
});

wall.addEventListener("mouseover", () => wall.classList.add("is-dimmed"));
wall.addEventListener("mouseout", (e) => {
  if (!wall.contains(e.relatedTarget)) wall.classList.remove("is-dimmed");
});

init();
