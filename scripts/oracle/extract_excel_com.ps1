param(
  [Parameter(Mandatory = $true)][string]$WorkbookPath,
  [string]$SheetName = ""
)

$resolved = (Resolve-Path -LiteralPath $WorkbookPath).Path
$hashBefore = (Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash.ToLowerInvariant()
$excel = $null
$workbook = $null
$sheet = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.AskToUpdateLinks = $false
  $workbook = $excel.Workbooks.Open($resolved, 0, $true)
  $sheet = if ($SheetName) { $workbook.Worksheets.Item($SheetName) } else { $workbook.Worksheets.Item(1) }
  $excel.CalculateFullRebuild()

  $rows = foreach ($bounds in @(@(21, 32), @(34, 44), @(60, 70), @(72, 81), @(85, 100), @(102, 114), @(136, 147), @(149, 154))) {
    for ($row = $bounds[0]; $row -le $bounds[1]; $row++) {
      [ordered]@{
        row = $row
        name = $sheet.Cells.Item($row, 2).Text
        count = $sheet.Cells.Item($row, 3).Value2
        unit = $sheet.Cells.Item($row, 4).Text
        unitPrice = $sheet.Cells.Item($row, 5).Value2
        cost = $sheet.Cells.Item($row, 6).Value2
        mass = $sheet.Cells.Item($row, 7).Value2
        countFormula = $sheet.Cells.Item($row, 3).Formula
        costFormula = $sheet.Cells.Item($row, 6).Formula
        massFormula = $sheet.Cells.Item($row, 7).Formula
      }
    }
  }

  [ordered]@{
    workbook = $resolved
    sha256Before = $hashBefore
    sheet = $sheet.Name
    openedReadOnly = $workbook.ReadOnly
    calculationEngine = "Microsoft Excel COM"
    calculationVersion = $workbook.CalculationVersion
    rows = $rows
  } | ConvertTo-Json -Depth 6
}
finally {
  if ($workbook) { $workbook.Close($false) }
  if ($excel) { $excel.Quit() }
  if ($sheet) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($sheet) }
  if ($workbook) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) }
  if ($excel) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
  $hashAfter = (Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hashAfter -ne $hashBefore) { throw "Source workbook changed during read-only extraction" }
}
