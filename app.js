import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBGqhvs2eVK8gfYGtk6jNJR34tpXtKa-nM",
  authDomain: "alice-saljer.firebaseapp.com",
  projectId: "alice-saljer",
  storageBucket: "alice-saljer.firebasestorage.app",
  messagingSenderId: "158329497694",
  appId: "1:158329497694:web:4b756d730ee775502faccf"
};

const ADMIN_PIN = "1234";
const COLLECTION_NAME = "alice_items";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const gallery = document.getElementById("gallery");
const adminPanel = document.getElementById("adminPanel");
const adminList = document.getElementById("adminList");

const adminGear = document.getElementById("adminGear");
const pinModal = document.getElementById("pinModal");
const closePin = document.getElementById("closePin");
const pinInput = document.getElementById("pinInput");
const pinSubmit = document.getElementById("pinSubmit");
const pinError = document.getElementById("pinError");
const logoutAdmin = document.getElementById("logoutAdmin");

const openUpload = document.getElementById("openUpload");
const uploadModal = document.getElementById("uploadModal");
const closeUpload = document.getElementById("closeUpload");
const itemImage = document.getElementById("itemImage");
const itemSize = document.getElementById("itemSize");
const itemPrice = document.getElementById("itemPrice");
const uploadItem = document.getElementById("uploadItem");
const uploadStatus = document.getElementById("uploadStatus");

const statAvailable = document.getElementById("statAvailable");
const statHandle = document.getElementById("statHandle");
const statHandleValue = document.getElementById("statHandleValue");
const statHistory = document.getElementById("statHistory");
const statHistoryValue = document.getElementById("statHistoryValue");

const productModal = document.getElementById("productModal");
const closeProduct = document.getElementById("closeProduct");
const modalImage = document.getElementById("modalImage");
const modalPrice = document.getElementById("modalPrice");
const modalSize = document.getElementById("modalSize");
const buyButton = document.getElementById("buyButton");
const prevItem = document.getElementById("prevItem");
const nextItem = document.getElementById("nextItem");

const buyModal = document.getElementById("buyModal");
const closeBuy = document.getElementById("closeBuy");
const buyerName = document.getElementById("buyerName");
const buyerMessage = document.getElementById("buyerMessage");
const sendBuy = document.getElementById("sendBuy");
const buyStatus = document.getElementById("buyStatus");

const toast = document.getElementById("toast");

let allItems = [];
let publicItems = [];
let currentIndex = 0;
let currentAdminFilter = "reserved";
let isAdmin = localStorage.getItem("alice_admin") === "true";

function showToast(text) {
  toast.textContent = text;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2800);
}

function statusOf(item) {
  if (item.status === "paid") return "reserved";
  return item.status || "available";
}

function isSoldLike(item) {
  const s = statusOf(item);
  return s === "reserved" || s === "delivered";
}

function statusLabel(status) {
  if (status === "available") return "Till salu";
  if (status === "reserved") return "Hantera";
  if (status === "delivered") return "Historik";
  return "Till salu";
}

function priceNumber(price) {
  const cleaned = String(price || "").replace(",", ".").match(/\d+(\.\d+)?/);
  return cleaned ? Number(cleaned[0]) : 0;
}

function formatKr(value) {
  return `${Math.round(value).toLocaleString("sv-SE")} kr`;
}

function updateStats() {
  const available = allItems.filter(item => statusOf(item) === "available");
  const handle = allItems.filter(item => statusOf(item) === "reserved");
  const history = allItems.filter(item => statusOf(item) === "delivered");

  const handleTotal = handle.reduce((sum, item) => sum + priceNumber(item.price), 0);
  const historyTotal = history.reduce((sum, item) => sum + priceNumber(item.price), 0);

  statAvailable.textContent = available.length;
  statHandle.textContent = handle.length;
  statHandleValue.textContent = `tot. ${formatKr(handleTotal)}`;
  statHistory.textContent = history.length;
  statHistoryValue.textContent = `tot. ${formatKr(historyTotal)}`;
}

function sortPublic(items) {
  return [...items].sort((a, b) => {
    const aSold = statusOf(a) === "reserved";
    const bSold = statusOf(b) === "reserved";

    if (aSold && !bSold) return 1;
    if (!aSold && bSold) return -1;

    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  });
}

function sortAdmin(items) {
  return [...items].sort((a, b) => {
    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  });
}

function renderGallery() {
  gallery.innerHTML = "";

  publicItems = sortPublic(
    allItems.filter(item => statusOf(item) !== "delivered")
  );

  if (publicItems.length === 0) {
    gallery.innerHTML = "<p>Inga saker upplagda ännu.</p>";
    return;
  }

  publicItems.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "card";

    if (statusOf(item) === "reserved") card.classList.add("sold");

    card.innerHTML = `
      <img src="${item.imageData}" alt="Vara" />
      <div class="card-info">
        <div class="card-price">${escapeHtml(item.price || "")}</div>
        <div class="card-size">${item.size ? "Storlek " + escapeHtml(item.size) : ""}</div>
      </div>
      ${statusOf(item) === "reserved" ? `<div class="sold-badge">♥<br>SÅLD!</div>` : ""}
    `;

    card.addEventListener("click", () => openProduct(index));
    gallery.appendChild(card);
  });
}

function renderAdmin() {
  if (!isAdmin) {
    adminPanel.classList.add("hidden");
    return;
  }

  adminPanel.classList.remove("hidden");
  adminList.innerHTML = "";
  updateStats();

  let items = sortAdmin(allItems).filter(item => statusOf(item) === currentAdminFilter);

  if (items.length === 0) {
    adminList.innerHTML = `<p>Inget att visa under ${filterName(currentAdminFilter)}.</p>`;
    return;
  }

  items.forEach(item => {
    const status = statusOf(item);
    const card = document.createElement("article");
    card.className = "admin-card";

    card.innerHTML = `
      <img src="${item.imageData}" alt="Vara" />
      <div>
        <h4>${escapeHtml(item.price || "")} · ${escapeHtml(item.size || "")}</h4>
        <p><strong>Status:</strong> ${statusLabel(status)}</p>
        ${
          item.buyerName
            ? `<p><strong>Köpare:</strong> ${escapeHtml(item.buyerName)}</p>
               <p><strong>Meddelande:</strong> ${escapeHtml(item.buyerMessage || "-")}</p>`
            : `<p>Ingen köpare ännu.</p>`
        }
        <div class="admin-actions">
          ${adminButtons(status)}
        </div>
      </div>
    `;

    card.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", () => handleAdminAction(item, btn.dataset.action));
    });

    adminList.appendChild(card);
  });
}

function filterName(filter) {
  if (filter === "available") return "Till salu";
  if (filter === "reserved") return "Hantera";
  if (filter === "delivered") return "Historik";
  return "";
}

function adminButtons(status) {
  if (status === "available") {
    return `
      <button data-action="reserve" class="primary-action secondary">Hantera</button>
      <button data-action="delete" class="danger right-action">Ta bort</button>
    `;
  }

  if (status === "reserved") {
    return `
      <button data-action="delivered" class="primary-action">Historik</button>
      <button data-action="available" class="secondary right-action">Lägg tillbaks</button>
      <button data-action="delete" class="danger">Ta bort</button>
    `;
  }

  if (status === "delivered") {
    return `
      <button data-action="available" class="secondary right-action">Lägg tillbaks</button>
      <button data-action="delete" class="danger">Ta bort</button>
    `;
  }

  return "";
}

async function handleAdminAction(item, action) {
  const ref = doc(db, COLLECTION_NAME, item.id);

  try {
    if (action === "reserve") {
      await updateDoc(ref, {
        status: "reserved",
        reservedAt: serverTimestamp()
      });
      showToast("Flyttad till Hantera");
    }

    if (action === "delivered") {
      await updateDoc(ref, {
        status: "delivered",
        deliveredAt: serverTimestamp()
      });
      showToast("Flyttad till Historik");
    }

    if (action === "available") {
      await updateDoc(ref, {
        status: "available",
        buyerName: "",
        buyerMessage: "",
        reservedAt: null,
        deliveredAt: null,
        paidAt: null
      });
      showToast("Tillbaka till salu");
    }

    if (action === "delete") {
      const ok = confirm("Vill du ta bort varan helt?");
      if (!ok) return;
      await deleteDoc(ref);
      showToast("Vara borttagen");
    }
  } catch (err) {
    console.error(err);
    showToast("Något gick fel");
  }
}

function openProduct(index) {
  currentIndex = index;
  const item = publicItems[currentIndex];

  modalImage.src = item.imageData;
  modalPrice.textContent = item.price || "";
  modalSize.textContent = item.size ? `Storlek ${item.size}` : "";

  if (statusOf(item) === "reserved") {
    buyButton.textContent = "Redan såld";
    buyButton.disabled = true;
  } else {
    buyButton.textContent = "Köp / reservera";
    buyButton.disabled = false;
  }

  productModal.classList.remove("hidden");
}

function moveProduct(direction) {
  if (!publicItems.length) return;
  currentIndex += direction;
  if (currentIndex < 0) currentIndex = publicItems.length - 1;
  if (currentIndex >= publicItems.length) currentIndex = 0;
  openProduct(currentIndex);
}

async function submitBuy() {
  const item = publicItems[currentIndex];
  const name = buyerName.value.trim();
  const message = buyerMessage.value.trim();

  if (!name) {
    buyStatus.textContent = "Skriv ditt namn först.";
    return;
  }

  if (!item || statusOf(item) === "reserved") {
    buyStatus.textContent = "Den här varan är redan reserverad.";
    return;
  }

  sendBuy.disabled = true;
  buyStatus.textContent = "Skickar...";

  try {
    await updateDoc(doc(db, COLLECTION_NAME, item.id), {
      status: "reserved",
      buyerName: name,
      buyerMessage: message,
      reservedAt: serverTimestamp()
    });

    buyModal.classList.add("hidden");
    productModal.classList.add("hidden");
    showToast("Tack! Alice har fått din förfrågan 💜");
  } catch (err) {
    console.error(err);
    buyStatus.textContent = "Något gick fel. Testa igen.";
  } finally {
    sendBuy.disabled = false;
  }
}

async function uploadNewItem() {
  const file = itemImage.files[0];
  const size = itemSize.value.trim();
  const price = itemPrice.value.trim();

  if (!file || !size || !price) {
    uploadStatus.textContent = "Välj bild och fyll i storlek och pris.";
    return;
  }

  uploadItem.disabled = true;
  uploadStatus.textContent = "Komprimerar bild...";

  try {
    const imageData = await compressImageToFirestoreSize(file);

    uploadStatus.textContent = "Sparar vara...";

    const id = crypto.randomUUID();

    await setDoc(doc(db, COLLECTION_NAME, id), {
      imageData,
      size,
      price,
      status: "available",
      buyerName: "",
      buyerMessage: "",
      createdAt: serverTimestamp(),
      reservedAt: null,
      deliveredAt: null,
      paidAt: null
    });

    itemImage.value = "";
    itemSize.value = "";
    itemPrice.value = "";
    uploadStatus.textContent = "";
    uploadModal.classList.add("hidden");
    currentAdminFilter = "available";
    setActiveFilter("available");
    showToast("Varan är upplagd");
  } catch (err) {
    console.error(err);
    uploadStatus.textContent = err.message || "Något gick fel.";
  } finally {
    uploadItem.disabled = false;
  }
}

async function compressImageToFirestoreSize(file) {
  let maxWidth = 1000;
  let quality = 0.74;

  for (let attempt = 0; attempt < 8; attempt++) {
    const dataUrl = await resizeImage(file, maxWidth, quality);

    if (dataUrl.length < 850000) {
      return dataUrl;
    }

    maxWidth = Math.round(maxWidth * 0.86);
    quality = Math.max(0.48, quality - 0.06);
  }

  throw new Error("Bilden är för stor. Testa en annan bild eller beskär den först.");
}

function resizeImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = event => {
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };

      img.onerror = reject;
      img.src = event.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function applyAdminState() {
  if (isAdmin) {
    adminPanel.classList.remove("hidden");
  } else {
    adminPanel.classList.add("hidden");
  }

  renderAdmin();
}

function setActiveFilter(filter) {
  document.querySelectorAll(".filter").forEach(button => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

adminGear.addEventListener("click", () => {
  pinModal.classList.remove("hidden");
  pinInput.focus();
});

closePin.addEventListener("click", () => pinModal.classList.add("hidden"));

pinSubmit.addEventListener("click", () => {
  if (pinInput.value === ADMIN_PIN) {
    isAdmin = true;
    localStorage.setItem("alice_admin", "true");
    pinInput.value = "";
    pinError.textContent = "";
    pinModal.classList.add("hidden");
    applyAdminState();
    showToast("Adminläge öppnat");
  } else {
    pinError.textContent = "Fel PIN.";
  }
});

logoutAdmin.addEventListener("click", () => {
  isAdmin = false;
  localStorage.removeItem("alice_admin");
  applyAdminState();
  showToast("Utloggad");
});

openUpload.addEventListener("click", () => {
  itemImage.value = "";
  itemSize.value = "";
  itemPrice.value = "";
  uploadStatus.textContent = "";
  uploadModal.classList.remove("hidden");
});

closeUpload.addEventListener("click", () => uploadModal.classList.add("hidden"));
uploadItem.addEventListener("click", uploadNewItem);

closeProduct.addEventListener("click", () => productModal.classList.add("hidden"));
prevItem.addEventListener("click", () => moveProduct(-1));
nextItem.addEventListener("click", () => moveProduct(1));

buyButton.addEventListener("click", () => {
  buyerName.value = "";
  buyerMessage.value = "";
  buyStatus.textContent = "";
  buyModal.classList.remove("hidden");
});

closeBuy.addEventListener("click", () => buyModal.classList.add("hidden"));
sendBuy.addEventListener("click", submitBuy);

document.querySelectorAll(".filter").forEach(button => {
  button.addEventListener("click", () => {
    currentAdminFilter = button.dataset.filter;
    setActiveFilter(currentAdminFilter);
    renderAdmin();
  });
});

productModal.addEventListener("click", e => {
  if (e.target === productModal) productModal.classList.add("hidden");
});

buyModal.addEventListener("click", e => {
  if (e.target === buyModal) buyModal.classList.add("hidden");
});

pinModal.addEventListener("click", e => {
  if (e.target === pinModal) pinModal.classList.add("hidden");
});

uploadModal.addEventListener("click", e => {
  if (e.target === uploadModal) uploadModal.classList.add("hidden");
});

const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));

onSnapshot(q, snapshot => {
  allItems = snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  renderGallery();
  renderAdmin();
}, error => {
  console.error(error);
  showToast("Kunde inte läsa databasen");
});

applyAdminState();
setActiveFilter(currentAdminFilter);
