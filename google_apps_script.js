/**
 * GOOGLE APPS SCRIPT ĐỒNG BỘ CHO GOOGLE SHEET "xử lý hạ tầng mnv"
 * Sheet ID: 1lrZfpO-Rl51PchFukqr3ushwbt3Ara3_F1mmQDheKKw
 */

var SPREADSHEET_ID = "1lrZfpO-Rl51PchFukqr3ushwbt3Ara3_F1mmQDheKKw";

/**
 * HÀM TEST & CẤP QUYỀN:
 * Chọn hàm "setup" rồi bấm "Chạy" (Run) trong Apps Script.
 * Google sẽ hiện thông báo cấp quyền -> Chọn Cho phép (Allow).
 * Sheet sẽ được ghi ngay 1 dòng TEST xác nhận thành công!
 */
function setup() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("xuly");
  if (!sheet) {
    sheet = ss.insertSheet("xuly");
  }
  sheet.appendRow(["TEST", "Kết nối Apps Script thành công lúc: " + new Date().toLocaleString()]);
  Logger.log("✅ Đã ghi thành công dòng TEST vào Sheet!");
  return "OK";
}

function doPost(e) {
  try {
    var contents = null;
    if (e && e.parameter && e.parameter.data) {
      contents = e.parameter.data;
    } else if (e && e.postData && e.postData.contents) {
      contents = e.postData.contents;
    }
    
    if (!contents) {
      return responseOutput("No data received");
    }
    
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("xuly");
    if (!sheet) {
      sheet = ss.insertSheet("xuly");
    }
    
    var action = data.action || "addOrUpdate";
    
    if (action === "addOrUpdate") {
      var item = data.item;
      var rowValues = [
        item.stt || "",
        item.pht || "",
        item.ttvt || "",
        item.hangmuc || "",
        item.tenTuyenCap || "",
        item.khuVuc || "",
        item.diaChi || "",
        item.kinhDo || "",
        item.viDo || "",
        item.giaiphap || "",
        item.tinhTrang || "",
        item.moTaHienTrang || "",
        item.phuongAn || "",
        Array.isArray(item.imagesBefore) ? item.imagesBefore.join(" ; ") : (item.imagesBefore || ""),
        Array.isArray(item.imagesAfter) ? item.imagesAfter.join(" ; ") : (item.imagesAfter || ""),
        item.ketQua || ""
      ];
      
      var lastRow = sheet.getLastRow();
      var foundRow = -1;
      
      if (lastRow > 1) {
        var sttCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < sttCol.length; i++) {
          if (String(sttCol[i][0]).trim() === String(item.stt).trim() && item.stt !== "") {
            foundRow = i + 2;
            break;
          }
        }
      }
      
      if (foundRow > 1) {
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }
      return responseOutput("OK");
      
    } else if (action === "syncAll") {
      var items = data.items || [];
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      
      if (items.length > 0) {
        var allRows = items.map(function(item, idx) {
          return [
            item.stt || (idx + 1),
            item.pht || "",
            item.ttvt || "",
            item.hangmuc || "",
            item.tenTuyenCap || "",
            item.khuVuc || "",
            item.diaChi || "",
            item.kinhDo || "",
            item.viDo || "",
            item.giaiphap || "",
            item.tinhTrang || "",
            item.moTaHienTrang || "",
            item.phuongAn || "",
            Array.isArray(item.imagesBefore) ? item.imagesBefore.join(" ; ") : (item.imagesBefore || ""),
            Array.isArray(item.imagesAfter) ? item.imagesAfter.join(" ; ") : (item.imagesAfter || ""),
            item.ketQua || ""
          ];
        });
        
        sheet.getRange(2, 1, allRows.length, allRows[0].length).setValues(allRows);
      }
      return responseOutput("OK");
    }
    
    return responseOutput("Unknown action");
  } catch (err) {
    return responseOutput("Error: " + err.toString());
  }
}

function responseOutput(text) {
  // Cho phép nhúng trong iframe để tránh lỗi 403 X-Frame-Options
  return HtmlService.createHtmlOutput("<html><body>" + text + "</body></html>")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
