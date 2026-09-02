// =========================================================
// USERS – manage assignees
// =========================================================

import { orders, users, saveUsers, pushHistory } from '../data.js';
import { esc, initials, toast } from '../utils.js';
import { openConfirmationModal, closeConfirmationModal } from '../components/ConfirmModal.js';

// We don't import any render function; use window.render().

export function render() {
  const container = document.getElementById('sectionPageBody');
  const userMap = {};
  orders.forEach(o => { const n = o.assignee || 'Unassigned'; userMap[n] = (userMap[n] || 0) + 1; });
  const allUsers = [...new Set([...users.map(u => u.name), ...Object.keys(userMap)])].filter(Boolean);

  container.innerHTML = `
    <div class="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
      <div class="flex flex-col sm:flex-row gap-2">
        <input id="newUserName" class="field-input border-white/10 bg-white/5 text-white placeholder:text-white/40" placeholder="Add assignee / user name">
        <button id="addUserBtn" class="px-4 py-2.5 rounded-xl bg-brand-teal hover:bg-[#2A5454] text-white font-bold text-sm transition">+ Add User</button>
      </div>
    </div>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      ${allUsers.map(n => {
        const count = userMap[n] || 0;
        return `<div class="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-3">
          <div class="w-11 h-11 rounded-full bg-brand-teal/20 text-brand-teal flex items-center justify-center font-black">${esc(initials(n))}</div>
          <div class="min-w-0 flex-1">
            <p class="font-black text-white truncate">${esc(n)}</p>
            <p class="text-xs text-white/40">${count} assigned work order${count === 1 ? '' : 's'}</p>
          </div>
          <button data-delete-user="${esc(n)}" class="w-9 h-9 rounded-lg text-red-500 hover:bg-red-500/10 flex items-center justify-center transition" title="Delete this user">✕</button>
        </div>`;
      }).join('')}
    </div>
  `;

  // Add user
  document.getElementById('addUserBtn').addEventListener('click', () => {
    if (!window.requireLogin || !window.requireLogin()) return;
    const name = document.getElementById('newUserName').value.trim();
    if (!name) { toast('Enter a user name.', 'error'); return; }
    if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) { toast('That user already exists.', 'error'); return; }
    users.push({ id: `USR-${Date.now()}`, name, active: true });
    saveUsers();
    render(); // re-render this page
    toast(`${name} added.`, 'success');
  });

  // Delete user
  document.querySelectorAll('[data-delete-user]').forEach(btn =>
    btn.addEventListener('click', () => {
      const name = btn.dataset.deleteUser;
      deleteUserFromList(name);
    })
  );
}

// ---------- Delete user from list (local function) ----------
function deleteUserFromList(name) {
  if (!name) return;
  if (!window.requireLogin || !window.requireLogin()) return;
  openConfirmationModal({
    title: 'Remove user',
    message: `Remove "${name}" from the user list? Work Orders assigned to them will become Unassigned.`,
    confirmText: 'Remove',
    confirmClass: 'bg-red-600 hover:bg-red-700',
    onConfirm: () => {
      pushHistory('remove user ' + name);
      users = users.filter(u => u.name !== name);
      orders.forEach(o => {
        if (o.assignee === name) o.assignee = 'Unassigned';
      });
      saveUsers();
      saveOrders();
      window.render(); // refresh main view
      render(); // refresh this page
      toast(`👤 ${name} removed. Affected Work Orders unassigned.`, 'success');
      closeConfirmationModal();
    },
  });
}