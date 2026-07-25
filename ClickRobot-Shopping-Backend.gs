/**
 * ClickRobot Shopping — Backend (Google Apps Script)
 * ---------------------------------------------------
 * วิธีติดตั้ง:
 * 1. สร้าง Google Sheet ใหม่ (ว่างเปล่า) ไว้เป็นฐานข้อมูล
 * 2. ในชีทนั้น ไปที่ ส่วนขยาย > Apps Script
 * 3. ลบโค้ดเดิมทั้งหมด แล้ววางไฟล์นี้ทั้งหมดแทน
 * 4. กด Deploy > New deployment > เลือกประเภท "Web app"
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 5. คัดลอก Web app URL ที่ได้ ไปวางแทนที่
 *    PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE ในไฟล์ clickrobot-shopping.html
 * 6. เปิดหน้าเว็บ แล้วลองสั่งซื้อ 1 รายการ ระบบจะสร้างชีท
 *    "Orders" และ "Totals" ให้อัตโนมัติ
 *
 * โครงสร้างชีท "Totals":
 *   หมวด | รหัสชิ้นส่วน | ชื่อชิ้นส่วน | รหัสอ้างอิง | เกษตร | คู้บอน | วัชรพล | บางบัวทอง | รวมทั้งหมด
 * โครงสร้างชีท "Orders" (log ทุกครั้งที่กดสั่งซื้อ — 1 แถวต่อ 1 ชิ้นส่วน):
 *   เวลา | สาขา | ผู้สั่ง | หมวด | ชื่อชิ้นส่วน | รหัสอ้างอิง | จำนวน
 * โครงสร้างชีท "History" (log ทุกครั้งที่กดสั่งซื้อ — 1 แถวต่อ 1 ครั้งที่กดสั่ง ไว้ดูว่าใครสั่งเมื่อไหร่):
 *   เวลา | สาขา | ผู้สั่ง | จำนวนรายการ | จำนวนชิ้นรวม | รายการที่สั่ง
 *
 * หมายเหตุการอัปเดต: ถ้าแก้โค้ดนี้ในโปรเจกต์ Apps Script ที่ deploy ไปแล้ว ให้ไปที่
 * Deploy > Manage deployments > กดไอคอนดินสอ > Version: New version > Deploy
 * (ใช้ deployment เดิม จะได้ URL เดิม ไม่ต้องแก้ API_URL ในไฟล์ html อีกรอบ)
 */

var BRANCHES = ['เกษตร', 'คู้บอน', 'วัชรพล', 'บางบัวทอง'];
var SHEET_ORDERS = 'Orders';
var SHEET_TOTALS = 'Totals';
var SHEET_HISTORY = 'History';

/** GET — ส่งยอดสะสมปัจจุบันทั้งหมดกลับเป็น JSON ให้หน้าเว็บแสดงในแท็บ "สรุปยอดรวม" */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var totalsSheet = ss.getSheetByName(SHEET_TOTALS);
    if (!totalsSheet || totalsSheet.getLastRow() < 2) {
      return jsonOutput({ rows: [] });
    }
    var data = totalsSheet.getDataRange().getValues();
    var rows = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[1]) continue; // ข้ามแถวว่าง
      var branchTotals = [];
      for (var b = 0; b < BRANCHES.length; b++) {
        branchTotals.push(Number(row[4 + b]) || 0);
      }
      rows.push({
        category: row[0],
        partId: row[1],
        partName: row[2],
        partNumber: row[3],
        branchTotals: branchTotals,
        grandTotal: Number(row[4 + BRANCHES.length]) || 0
      });
    }
    return jsonOutput({ rows: rows });
  } catch (err) {
    return jsonOutput({ rows: [], error: String(err) });
  }
}

/** POST — บันทึกคำสั่งซื้อ 1 ครั้ง (หลายรายการ) ลง Orders log และเพิ่มยอดสะสมใน Totals */
function doPost(e) {
  var lock = LockService.getScriptLock();
  var gotLock = lock.tryLock(25000);
  if (!gotLock) {
    return jsonOutput({ success: false, error: 'ระบบไม่ว่าง กรุณาลองใหม่อีกครั้ง' });
  }
  try {
    var payload = JSON.parse(e.postData.contents);
    var branch = payload.branch;
    var orderer = payload.orderer;
    var items = payload.items;

    if (!branch || BRANCHES.indexOf(branch) === -1) {
      return jsonOutput({ success: false, error: 'ไม่พบสาขาที่เลือก' });
    }
    if (!orderer) {
      return jsonOutput({ success: false, error: 'กรุณากรอกชื่อผู้สั่ง' });
    }
    if (!items || !items.length) {
      return jsonOutput({ success: false, error: 'ไม่มีรายการสั่งซื้อ' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ordersSheet = getOrCreateOrdersSheet(ss);
    var totalsSheet = getOrCreateTotalsSheet(ss);
    var historySheet = getOrCreateHistorySheet(ss);
    var timestamp = new Date();

    var itemCount = 0;
    var totalQty = 0;
    var summaryParts = [];

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item.qty || item.qty <= 0) continue;
      ordersSheet.appendRow([
        timestamp, branch, orderer, item.category || '',
        item.partName || '', item.partNumber || '', item.qty
      ]);
      incrementTotal(totalsSheet, branch, item);
      itemCount++;
      totalQty += Number(item.qty);
      summaryParts.push((item.partName || '') + ' x' + item.qty);
    }

    if (itemCount > 0) {
      historySheet.appendRow([
        timestamp, branch, orderer, itemCount, totalQty, summaryParts.join(', ')
      ]);
    }

    return jsonOutput({ success: true });
  } catch (err) {
    return jsonOutput({ success: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateOrdersSheet(ss) {
  var sh = ss.getSheetByName(SHEET_ORDERS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_ORDERS);
    sh.appendRow(['เวลา', 'สาขา', 'ผู้สั่ง', 'หมวด', 'ชื่อชิ้นส่วน', 'รหัสอ้างอิง', 'จำนวน']);
    sh.setFrozenRows(1);
    sh.getRange('A1:G1').setFontWeight('bold');
    sh.setColumnWidth(1, 140);
    sh.setColumnWidth(5, 220);
  }
  return sh;
}

function getOrCreateTotalsSheet(ss) {
  var sh = ss.getSheetByName(SHEET_TOTALS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_TOTALS);
    var header = ['หมวด', 'รหัสชิ้นส่วน', 'ชื่อชิ้นส่วน', 'รหัสอ้างอิง'].concat(BRANCHES).concat(['รวมทั้งหมด']);
    sh.appendRow(header);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
    sh.setColumnWidth(3, 220);
  }
  return sh;
}

/** ชีท "History" — 1 แถวต่อการกดสั่งซื้อ 1 ครั้ง (ไม่ใช่ 1 แถวต่อชิ้น) ไว้ดูว่าใครสั่งเมื่อไหร่แบบเร็ว ๆ */
function getOrCreateHistorySheet(ss) {
  var sh = ss.getSheetByName(SHEET_HISTORY);
  if (!sh) {
    sh = ss.insertSheet(SHEET_HISTORY);
    sh.appendRow(['เวลา', 'สาขา', 'ผู้สั่ง', 'จำนวนรายการ', 'จำนวนชิ้นรวม', 'รายการที่สั่ง']);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 6).setFontWeight('bold');
    sh.setColumnWidth(1, 140);
    sh.setColumnWidth(3, 160);
    sh.setColumnWidth(6, 340);
  }
  return sh;
}

/** หาแถวของชิ้นส่วนนี้ใน Totals (หรือสร้างใหม่) แล้วบวกจำนวนเข้าคอลัมน์ของสาขานั้น */
function incrementTotal(sh, branch, item) {
  var branchIndex = BRANCHES.indexOf(branch);
  if (branchIndex === -1) return;
  var branchCol = 5 + branchIndex; // คอลัมน์ E คือสาขาแรก (1-indexed)

  var lastRow = sh.getLastRow();
  var partIdCol = 2; // คอลัมน์ B = รหัสชิ้นส่วน
  var foundRow = -1;

  if (lastRow >= 2) {
    var ids = sh.getRange(2, partIdCol, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === item.partId) {
        foundRow = i + 2; // แปลงเป็นเลขแถวจริงในชีท (1-indexed)
        break;
      }
    }
  }

  if (foundRow === -1) {
    var newRow = [item.category || '', item.partId || '', item.partName || '', item.partNumber || ''];
    for (var b = 0; b < BRANCHES.length; b++) newRow.push(0);
    newRow.push(0); // ค่าตั้งต้นของ "รวมทั้งหมด" จะถูกแทนด้วยสูตรด้านล่าง
    sh.appendRow(newRow);
    foundRow = sh.getLastRow();

    var totalCol = 4 + BRANCHES.length + 1;
    var firstBranchColLetter = columnToLetter(5);
    var lastBranchColLetter = columnToLetter(4 + BRANCHES.length);
    sh.getRange(foundRow, totalCol).setFormula(
      '=SUM(' + firstBranchColLetter + foundRow + ':' + lastBranchColLetter + foundRow + ')'
    );
  }

  var cell = sh.getRange(foundRow, branchCol);
  var current = Number(cell.getValue()) || 0;
  cell.setValue(current + Number(item.qty));
}

function columnToLetter(col) {
  var letter = '';
  while (col > 0) {
    var rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - rem) / 26);
  }
  return letter;
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
