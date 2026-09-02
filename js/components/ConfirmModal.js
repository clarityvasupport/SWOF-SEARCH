// =========================================================
// CONFIRMATION MODAL – reusable confirm dialog
// =========================================================

export let pendingConfirmation = null;

export function openConfirmationModal({
  title,
  message,
  confirmText = 'Confirm',
  confirmClass = 'bg-brand-teal hover:bg-[#2A5454]',
  onConfirm,
}) {
  pendingConfirmation = onConfirm || null;
  document.getElementById('confirmModalTitle').textContent = title;
  document.getElementById('confirmModalMessage').textContent = message;
  const btn = document.getElementById('confirmModalConfirmBtn');
  btn.textContent = confirmText;
  btn.className = `px-4 py-2.5 rounded-lg text-white text-sm font-bold transition ${confirmClass}`;
  document.getElementById('confirmModal').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

export function closeConfirmationModal() {
  document.getElementById('confirmModal').classList.add('hidden');
  pendingConfirmation = null;
  // We'll let the caller handle body overflow, or we can try to be smart.
  // It's safe to remove overflow if no other modal is open, but we'll keep it simple.
  // The caller (e.g., render.js) will manage overflow.
}