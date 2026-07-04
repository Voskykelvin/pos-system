'use strict';

/**
 * ESC/POS Thermal Printing & Cash Drawer Control Utility
 *
 * Provides hex byte command generators for standard 80mm/58mm ESC/POS thermal printers.
 */

// ESC/POS Commands
const COMMANDS = {
  INIT: '\x1B\x40',                 // Initialize printer
  ALIGN_LEFT: '\x1B\x61\x00',        // Left align
  ALIGN_CENTER: '\x1B\x61\x01',      // Center align
  ALIGN_RIGHT: '\x1B\x61\x02',       // Right align
  BOLD_ON: '\x1B\x45\x01',           // Emphasized mode on
  BOLD_OFF: '\x1B\x45\x00',          // Emphasized mode off
  DOUBLE_HEIGHT: '\x1B\x21\x10',     // Double height text
  NORMAL_TEXT: '\x1B\x21\x00',       // Normal text size
  CUT_FULL: '\x1D\x56\x00',          // Full paper cut
  CUT_PARTIAL: '\x1D\x56\x01',       // Partial paper cut
  DRAWER_KICK_PIN2: '\x1B\x70\x00\x19\xFA', // Kick drawer connected to Pin 2
  DRAWER_KICK_PIN5: '\x1B\x70\x01\x19\xFA'  // Kick drawer connected to Pin 5
};

/**
 * Returns raw bytes to kick open the connected cash drawer.
 * @param {number} pin - 2 or 5 (default 2)
 */
function getDrawerKickCommand(pin = 2) {
  return pin === 5 ? COMMANDS.DRAWER_KICK_PIN5 : COMMANDS.DRAWER_KICK_PIN2;
}

/**
 * Formats a plain text receipt summary for thermal receipt printing.
 */
function formatThermalReceipt({ businessName, orderNumber, items, total, changeDue, paymentMethod }) {
  const line = '--------------------------------';
  let receipt = '';

  receipt += COMMANDS.INIT;
  receipt += COMMANDS.ALIGN_CENTER;
  receipt += COMMANDS.BOLD_ON;
  receipt += `${businessName}\n`;
  receipt += COMMANDS.BOLD_OFF;
  receipt += `Receipt #${orderNumber}\n`;
  receipt += `${new Date().toLocaleString()}\n`;
  receipt += `${line}\n`;

  receipt += COMMANDS.ALIGN_LEFT;
  items.forEach((item) => {
    const name = item.name.length > 20 ? item.name.substring(0, 18) + '..' : item.name;
    const price = Number(item.unitPrice * item.quantity).toFixed(2);
    receipt += `${name.padEnd(22)} ${price.padStart(9)}\n`;
    receipt += `  x${item.quantity} @ ${Number(item.unitPrice).toFixed(2)}\n`;
  });

  receipt += `${line}\n`;
  receipt += COMMANDS.ALIGN_RIGHT;
  receipt += COMMANDS.BOLD_ON;
  receipt += `TOTAL: KES ${Number(total).toFixed(2)}\n`;
  receipt += COMMANDS.BOLD_OFF;
  receipt += `Paid via: ${paymentMethod.toUpperCase()}\n`;
  if (changeDue > 0) {
    receipt += `Change: KES ${Number(changeDue).toFixed(2)}\n`;
  }
  receipt += `${line}\n`;

  receipt += COMMANDS.ALIGN_CENTER;
  receipt += `Thank you for your business!\n\n\n`;
  receipt += COMMANDS.CUT_PARTIAL;

  return receipt;
}

module.exports = {
  COMMANDS,
  getDrawerKickCommand,
  formatThermalReceipt
};
