<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    header('Location: ../dengluye.php');
    exit;
}

// 获取所有用户数据及其总积分
$users = $pdo->query("
    SELECT 
        u.id,
        u.username,
        SUM(sl.score_change) AS total_score,
        SUM(CASE WHEN sl.score_change > 0 THEN sl.score_change ELSE 0 END) AS add_score,
        SUM(CASE WHEN sl.score_change < 0 THEN sl.score_change ELSE 0 END) AS deduct_score
    FROM users u
    LEFT JOIN score_logs sl ON u.id = sl.user_id
    GROUP BY u.id
    ORDER BY total_score DESC
")->fetchAll(PDO::FETCH_ASSOC);

// 为用户生成排名
$rankingIndex = 1;
foreach ($users as &$user) {
    $user['ranking'] = $rankingIndex++;
}
unset($user);

// 获取每日加扣分详情
$dailyLogs = [];
foreach ($users as $user) {
    $logs = $pdo->prepare("
        SELECT 
            DATE(sl.created_at) AS date,
            GROUP_CONCAT(CONCAT(sl.score_change, '（', sl.description, '）') SEPARATOR ' ') AS details
        FROM score_logs sl
        WHERE sl.user_id = ?
        GROUP BY DATE(sl.created_at)
        ORDER BY date
    ");
    $logs->execute([$user['id']]);
    $dailyLogs[$user['username']] = $logs->fetchAll(PDO::FETCH_KEY_PAIR);
}

// 动态生成日期列头
$allDates = [];
foreach ($dailyLogs as $logs) {
    $allDates = array_merge($allDates, array_keys($logs));
}
$allDates = array_unique($allDates);
sort($allDates);

// 格式化日期为"m月d日"
$allDatesFormatted = array_map(function ($date) {
    return date('n月j日', strtotime($date));
}, $allDates);

// 简单的XLSX生成器类 - 不使用ZipArchive
class SimpleXLSX {
    private $files = [];
    
    public function addWorksheet($name, $data, $headers) {
        $xml = $this->createWorksheetXML($name, $data, $headers);
        $this->files["xl/worksheets/sheet1.xml"] = $xml;
    }
    
    private function createWorksheetXML($name, $data, $headers) {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n";
        $xml .= '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' . "\n";
        $xml .= '<sheetData>' . "\n";
        
        $rowNum = 1;
        
        // 写入表头 - 样式1 (加粗 + 居中 + 背景色)
        $xml .= '<row r="' . $rowNum . '">' . "\n";
        $colNum = 1;
        foreach ($headers as $header) {
            $xml .= '<c r="' . $this->getCellReference($rowNum, $colNum) . '" s="1" t="inlineStr"><is><t>' . htmlspecialchars($header) . '</t></is></c>' . "\n";
            $colNum++;
        }
        $xml .= '</row>' . "\n";
        $rowNum++;
        
        // 写入数据行
        foreach ($data as $row) {
            $xml .= '<row r="' . $rowNum . '">' . "\n";
            $colNum = 1;
            foreach ($row as $cell) {
                // 前五列使用样式2 (加粗 + 居中)，其他列使用样式0 (居中)
                $styleIndex = ($colNum <= 5) ? 2 : 0;
                
                if (is_numeric($cell) && $cell !== '') {
                    $xml .= '<c r="' . $this->getCellReference($rowNum, $colNum) . '" s="' . $styleIndex . '" t="n"><v>' . $cell . '</v></c>' . "\n";
                } else {
                    $xml .= '<c r="' . $this->getCellReference($rowNum, $colNum) . '" s="' . $styleIndex . '" t="inlineStr"><is><t>' . htmlspecialchars($cell) . '</t></is></c>' . "\n";
                }
                $colNum++;
            }
            $xml .= '</row>' . "\n";
            $rowNum++;
        }
        
        $xml .= '</sheetData>' . "\n";
        $xml .= '</worksheet>' . "\n";
        
        return $xml;
    }
    
    private function getCellReference($row, $col) {
        $colLetter = '';
        while ($col > 0) {
            $col--;
            $colLetter = chr(65 + ($col % 26)) . $colLetter;
            $col = intval($col / 26);
        }
        return $colLetter . $row;
    }
    
    public function createXLSX() {
        // 添加必要的XLSX文件结构
        $this->files['[Content_Types].xml'] = $this->getContentTypes();
        $this->files['_rels/.rels'] = $this->getRels();
        $this->files['xl/workbook.xml'] = $this->getWorkbook();
        $this->files['xl/_rels/workbook.xml.rels'] = $this->getWorkbookRels();
        $this->files['xl/styles.xml'] = $this->getStyles();
        
        // 手动创建ZIP文件内容
        return $this->createZipContent();
    }
    
    private function createZipContent() {
        // 使用不压缩的方式创建ZIP文件，更可靠
        $zipData = '';
        $cdEntries = [];
        $offset = 0;
        
        // 添加文件到ZIP (不压缩)
        foreach ($this->files as $filename => $content) {
            $fileData = $content;
            $crc = crc32($fileData);
            
            // 本地文件头
            $localHeader = "\x50\x4b\x03\x04"; // 本地文件头签名
            $localHeader .= "\x14\x00"; // 版本
            $localHeader .= "\x00\x00"; // 标志
            $localHeader .= "\x00\x00"; // 压缩方法 (无压缩)
            $localHeader .= pack("V", time()); // 时间戳
            $localHeader .= pack("V", $crc); // CRC32
            $localHeader .= pack("V", strlen($fileData)); // 压缩后大小 (与原始大小相同)
            $localHeader .= pack("V", strlen($fileData)); // 原始大小
            $localHeader .= pack("v", strlen($filename)); // 文件名长度
            $localHeader .= pack("v", 0); // 额外字段长度
            $localHeader .= $filename; // 文件名
            $localHeader .= $fileData; // 未压缩数据
            
            $zipData .= $localHeader;
            
            // 中央目录条目
            $cdEntry = "\x50\x4b\x01\x02"; // 中央目录签名
            $cdEntry .= "\x14\x03"; // 版本
            $cdEntry .= "\x14\x00"; // 最小版本
            $cdEntry .= "\x00\x00"; // 标志
            $cdEntry .= "\x00\x00"; // 压缩方法 (无压缩)
            $cdEntry .= pack("V", time()); // 时间戳
            $cdEntry .= pack("V", $crc); // CRC32
            $cdEntry .= pack("V", strlen($fileData)); // 压缩后大小
            $cdEntry .= pack("V", strlen($fileData)); // 原始大小
            $cdEntry .= pack("v", strlen($filename)); // 文件名长度
            $cdEntry .= pack("v", 0); // 额外字段长度
            $cdEntry .= pack("v", 0); // 文件注释长度
            $cdEntry .= pack("v", 0); // 磁盘号
            $cdEntry .= pack("v", 0); // 内部属性
            $cdEntry .= pack("V", 32); // 外部属性
            $cdEntry .= pack("V", $offset); // 本地头偏移
            $cdEntry .= $filename; // 文件名
            
            $cdEntries[] = $cdEntry;
            $offset += strlen($localHeader);
        }
        
        // 中央目录
        $centralDir = implode('', $cdEntries);
        $cdSize = strlen($centralDir);
        $cdOffset = strlen($zipData);
        
        // 中央目录结束记录
        $endRecord = "\x50\x4b\x05\x06"; // 结束记录签名
        $endRecord .= "\x00\x00"; // 磁盘号
        $endRecord .= "\x00\x00"; // 中央目录磁盘号
        $endRecord .= pack("v", count($cdEntries)); // 本磁盘记录数
        $endRecord .= pack("v", count($cdEntries)); // 总记录数
        $endRecord .= pack("V", $cdSize); // 中央目录大小
        $endRecord .= pack("V", $cdOffset); // 中央目录偏移
        $endRecord .= "\x00\x00"; // ZIP文件注释长度
        
        return $zipData . $centralDir . $endRecord;
    }
    
    private function getContentTypes() {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>';
    }
    
    private function getRels() {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>';
    }
    
    private function getWorkbook() {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <sheets>
        <sheet name="班级积分报表" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
    </sheets>
</workbook>';
    }
    
    private function getWorkbookRels() {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>';
    }
    
    private function getStyles() {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <fonts count="2">
        <font><sz val="12"/><name val="宋体"/></font>
        <font><b/><sz val="12"/><name val="宋体"/></font>
    </fonts>
    <fills count="2">
        <fill><patternFill patternType="none"/></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FFD9E2F3"/></patternFill></fill>
    </fills>
    <borders count="1">
        <border><left/><right/><top/><bottom/></border>
    </borders>
    <cellXfs count="3">
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="center"/></xf>
        <xf numFmtId="0" fontId="1" fillId="1" borderId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>
        <xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>
    </cellXfs>
</styleSheet>';
    }
}

// 准备数据
$exportData = [];
foreach ($users as $user) {
    $dailyDetails = $dailyLogs[$user['username']] ?? [];
    $dailyRow = array_map(function ($date) use ($dailyDetails) {
        return $dailyDetails[$date] ?? '';
    }, $allDates);
    
    $row = [
        $user['ranking'],
        $user['username'],
        $user['total_score'] ?? 0,
        $user['add_score'] ?? 0,
        $user['deduct_score'] ?? 0
    ];
    $exportData[] = array_merge($row, $dailyRow);
}

// 生成XLSX内容
$headers = array_merge(['排名', '用户名', '总积分', '累计加分', '累计扣分'], $allDatesFormatted);
$xlsx = new SimpleXLSX();
$xlsx->addWorksheet('班级积分报表', $exportData, $headers);
$xlsxContent = $xlsx->createXLSX();

// 设置文件头
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="班级积分报表_' . date('Ymd') . '.xlsx"');
header('Cache-Control: max-age=0');
header('Expires: 0');
header('Pragma: public');

// 输出XLSX内容
echo $xlsxContent;
exit;
?>