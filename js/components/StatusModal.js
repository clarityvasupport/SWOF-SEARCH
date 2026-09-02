// =========================================================
// STATUS MODAL – quick status change
// =========================================================

import { orders, saveOrders } from '../data.js';
import { openConfirmationModal, closeConfirmationModal } from './ConfirmModal.js';
// We'll import render and other things later; for now we'll keep it simple.
// We'll rely on the main script to handle the actual status change.

// These will be set by the caller (render.js) when opening the modal.
let selectedId = null;

export function openStatusModal(id) {
  if (!id) return;
  const o = orders.find(x => x.id === id);
  if (!o) return;
  selectedId = id;
  document.getElementById('statusModalText').textContent = `${o.id} • ${o.title}`;
  document.getElementById('statusModalSelect').value = o.status;
  document.getElementById('statusModal').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

export function closeStatusModal() {
  document.getElementById('statusModal').classList.add('hidden');
  selectedId = null;
  // body overflow managed by caller.
}

export function confirmStatus() {
  const o = orders.find(x => x.id === selectedId);
  if (!o) return;
  const next = document.getElementById('statusModalSelect').value;
  if (next === o.status) {
    closeStatusModal();
    return;
  }
  // Use the confirmation modal to confirm
  openConfirmationModal({
    title: 'Change status',
    message: `Change ${o.id} from ${o.status} to ${next}?`,
    confirmText: 'Confirm change',
    onConfirm: () => {
      // We need to call a function that actually changes the status.
      // This will be imported from render.js later.
      // For now, we'll just trigger a custom event that the main app listens to.
      const event = new CustomEvent('status-change-confirmed', { detail: { id: o.id, status: next } });
      document.dispatchEvent(event);
      closeStatusModal();
      closeConfirmationModal();
    },
  });
}