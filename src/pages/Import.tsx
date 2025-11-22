import { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, File, X, FileSpreadsheet, FileText, Database, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx-js-style";
import mammoth from "mammoth";
import { RawData } from "@/lib/data-models";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ExcelData {
  headers: string[];
  rows: any[][];
}

type ImportMode = "update" | "append" | "replace";

const Import = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [wordContent, setWordContent] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("update");
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [lastImportStats, setLastImportStats] = useState<{
    newRecords: number;
    updatedRecords: number;
    totalRecords: number;
    importDate: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedFileTypes = [
    ".xlsx",
    ".xls",
    ".docx",
    ".doc",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ];

  const handleFileSelect = async (file: File) => {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const fileType = file.type;

    // Validate file type
    if (
      !acceptedFileTypes.includes(`.${fileExtension}`) &&
      !acceptedFileTypes.includes(fileType)
    ) {
      toast.error("Please upload an Excel (.xlsx, .xls) or Word (.docx, .doc) file");
      return;
    }

    setSelectedFile(file);
    setExcelData(null);
    setWordContent(null);

    try {
      if (fileExtension === "xlsx" || fileExtension === "xls") {
        await handleExcelFile(file);
      } else if (fileExtension === "docx" || fileExtension === "doc") {
        await handleWordFile(file);
      }
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error("Error processing file. Please try again.");
    }
  };

  const handleExcelFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (jsonData.length === 0) {
          toast.error("The Excel file appears to be empty");
          return;
        }

        const headers = (jsonData[0] as any[]).map((h) => String(h || "").trim());
        const rows = jsonData.slice(1) as any[][];

        // Try to find column indices for required fields
        const accountNumberIdx = headers.findIndex(h => 
          /account.*number/i.test(h) || /account/i.test(h)
        );
        const angazaIdIdx = headers.findIndex(h => 
          /angaza/i.test(h) || /angaza.*id/i.test(h)
        );
        const groupNameIdx = headers.findIndex(h => 
          /group.*name/i.test(h) || /^group$/i.test(h)
        );
        const ownerNameIdx = headers.findIndex(h => 
          /owner.*name/i.test(h) || /^owner$/i.test(h) || /customer.*name/i.test(h) || /client.*name/i.test(h)
        );
        const productNameIdx = headers.findIndex(h => 
          /product.*name/i.test(h) || /product/i.test(h)
        );
        const productTypeIdx = headers.findIndex(h => 
          /product.*type/i.test(h) || /type/i.test(h)
        );
        const productDescIdx = headers.findIndex(h => 
          /product.*desc/i.test(h) || /description/i.test(h) || /customer.*location/i.test(h) || /^location$/i.test(h)
        );
        const regDateIdx = headers.findIndex(h => 
          /registration.*date/i.test(h) || /reg.*date/i.test(h) || /registration.*date.*utc/i.test(h) || /^registration$/i.test(h)
        );
        const districtIdx = headers.findIndex(h => 
          /district/i.test(h) || /^district$/i.test(h) || /which.*district/i.test(h)
        );
        
        // Log found column indices for debugging
        console.log("Column indices found:", {
          accountNumber: accountNumberIdx,
          angazaId: angazaIdIdx,
          groupName: groupNameIdx,
          ownerName: ownerNameIdx,
          registrationDate: regDateIdx,
          district: districtIdx,
          allHeaders: headers,
        });

        // Store raw data
        const existingRawData = (await getStorageItem<RawData[]>(STORAGE_KEYS.RAW_DATA)) || [];
        const importTimestamp = new Date().toISOString();
        const newRawData: RawData[] = rows
          .filter(row => row[accountNumberIdx]) // Only rows with account number
          .map((row, idx) => {
            // Extract and clean values
            const groupNameValue = groupNameIdx >= 0 ? String(row[groupNameIdx] || "").trim() : "";
            const ownerNameValue = ownerNameIdx >= 0 ? String(row[ownerNameIdx] || "").trim() : "";
            const angazaIdValue = angazaIdIdx >= 0 ? String(row[angazaIdIdx] || "").trim() : "";
            const regDateValue = regDateIdx >= 0 ? String(row[regDateIdx] || "").trim() : "";
            const districtValue = districtIdx >= 0 ? String(row[districtIdx] || "").trim() : "";
            
            console.log(`Row ${idx} - Group Name: "${groupNameValue}", Owner Name: "${ownerNameValue}", Reg Date: "${regDateValue}", District: "${districtValue}"`);
            
            return {
              id: `${Date.now()}-${idx}`,
              accountNumber: String(row[accountNumberIdx] || "").trim(),
              angazaId: angazaIdValue || undefined,
              groupName: groupNameValue || undefined,
              ownerName: ownerNameValue || undefined,
              productName: productNameIdx >= 0 ? String(row[productNameIdx] || "").trim() : "",
              productType: productTypeIdx >= 0 ? String(row[productTypeIdx] || "").trim() : "",
              productDescription: productDescIdx >= 0 ? String(row[productDescIdx] || "").trim() : "",
              registrationDate: regDateValue,
              district: districtValue ? districtValue : undefined,
              importedAt: importTimestamp,
            };
          });

        let updatedRawData: RawData[] = [];
        let newRecords = 0;
        let updatedRecords = 0;

        if (importMode === "replace") {
          // Replace all existing data
          updatedRawData = newRawData;
          newRecords = newRawData.length;
          updatedRecords = 0;
        } else if (importMode === "append") {
          // Append only - don't update existing records
          updatedRawData = [...existingRawData];
          newRawData.forEach(newItem => {
            const exists = updatedRawData.some(
              item => item.accountNumber === newItem.accountNumber
            );
            if (!exists) {
              updatedRawData.push(newItem);
              newRecords++;
            }
          });
        } else {
          // Update mode (default) - update existing, add new
          updatedRawData = [...existingRawData];
          newRawData.forEach(newItem => {
            const existingIndex = updatedRawData.findIndex(
              item => item.accountNumber === newItem.accountNumber
            );
            if (existingIndex >= 0) {
              updatedRawData[existingIndex] = newItem;
              updatedRecords++;
            } else {
              updatedRawData.push(newItem);
              newRecords++;
            }
          });
        }

        await setStorageItem(STORAGE_KEYS.RAW_DATA, updatedRawData);
        setTotalRecords(updatedRawData.length);
        setLastImportStats({
          newRecords,
          updatedRecords,
          totalRecords: updatedRawData.length,
          importDate: importTimestamp,
        });
        setExcelData({ headers, rows });
        
        const modeText = importMode === "replace" ? "replaced" : importMode === "append" ? "added (append only)" : "imported";
        toast.success(
          `Successfully ${modeText} ${newRawData.length} records. ` +
          `New: ${newRecords}, Updated: ${updatedRecords}, Total: ${updatedRawData.length}`,
          { duration: 5000 }
        );
      } catch (error) {
        console.error("Error parsing Excel:", error);
        toast.error("Error parsing Excel file");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleWordFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const result = await mammoth.extractRawText({ arrayBuffer });
        setWordContent(result.value);
        toast.success("Successfully imported Word document");
      } catch (error) {
        console.error("Error parsing Word:", error);
        toast.error("Error parsing Word document");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setExcelData(null);
    setWordContent(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Load total records count on mount
  useEffect(() => {
    const loadTotalRecords = async () => {
      const existingData = (await getStorageItem<RawData[]>(STORAGE_KEYS.RAW_DATA)) || [];
      setTotalRecords(existingData.length);
    };
    loadTotalRecords();
  }, []);

  const getFileIcon = () => {
    if (!selectedFile) return null;
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (extension === "xlsx" || extension === "xls") {
      return <FileSpreadsheet className="h-12 w-12 text-green-600" />;
    } else if (extension === "docx" || extension === "doc") {
      return <FileText className="h-12 w-12 text-blue-600" />;
    }
    return <File className="h-12 w-12 text-gray-600" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-gradient-to-r from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-800/40 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 bg-clip-text text-transparent">
              Import Data
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1 text-lg">
              Upload Excel (.xlsx, .xls) or Word (.docx, .doc) files 📤
            </p>
          </div>
        </div>

        <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-yellow-500/5" />
          <CardHeader className="relative z-10 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              Upload File
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300 mt-1">
              Drag and drop a file here, or click to select a file. Data will be saved permanently.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 pt-6">
            <div className="space-y-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="import-mode" className="text-gray-700 dark:text-gray-200 font-medium">Import Mode</Label>
                  <Select value={importMode} onValueChange={(value: ImportMode) => setImportMode(value)}>
                    <SelectTrigger id="import-mode" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="update">
                        Update Existing (Default) - Updates records with matching account numbers, adds new ones
                      </SelectItem>
                      <SelectItem value="append">
                        Append Only - Only adds new records, keeps all existing data unchanged
                      </SelectItem>
                      <SelectItem value="replace">
                        Replace All - Replaces all existing data with new import
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Database className="h-4 w-4" />
                  <span>Total Records: <strong className="text-foreground">{totalRecords}</strong></span>
                </div>
              </div>
              {importMode === "append" && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">Append Mode Selected</p>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">
                    This mode is perfect for monthly imports. It will only add new customers and won't modify existing records.
                  </p>
                </div>
              )}
            </div>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                isDragging
                  ? "border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 scale-105"
                  : "border-gray-300 dark:border-gray-700 hover:border-orange-400 dark:hover:border-orange-600 hover:bg-gradient-to-br hover:from-orange-50/50 hover:to-amber-50/50 dark:hover:from-orange-950/10 dark:hover:to-amber-950/10"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.docx,.doc"
                onChange={handleFileInputChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-4">
                  <div className={`p-4 rounded-full transition-all duration-300 ${
                    isDragging 
                      ? "bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 scale-110" 
                      : "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20"
                  }`}>
                    <Upload className={`h-12 w-12 transition-colors ${
                      isDragging ? "text-orange-600 dark:text-orange-400" : "text-orange-500 dark:text-orange-400"
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Excel (.xlsx, .xls) or Word (.docx, .doc) files
                    </p>
                  </div>
                </div>
              </label>
            </div>

            {selectedFile && (
              <div className="mt-4 p-4 border border-orange-200 dark:border-orange-800 rounded-xl bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  {getFileIcon()}
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{selectedFile.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  className="hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {excelData && (
          <Card>
            <CardHeader>
              <CardTitle>Excel Data Preview</CardTitle>
              <CardDescription>
                Showing {excelData.rows.length} rows of data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {excelData.headers.map((header, index) => (
                        <TableHead key={index}>{header || `Column ${index + 1}`}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {excelData.rows.slice(0, 100).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {excelData.headers.map((_, colIndex) => (
                          <TableCell key={colIndex}>
                            {row[colIndex] !== undefined && row[colIndex] !== null
                              ? String(row[colIndex])
                              : ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {excelData.rows.length > 100 && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Showing first 100 rows of {excelData.rows.length} total rows
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {wordContent && (
          <Card>
            <CardHeader>
              <CardTitle>Word Document Content</CardTitle>
              <CardDescription>Extracted text from the document</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto p-4 border rounded-lg bg-muted/50">
                <pre className="whitespace-pre-wrap text-sm font-sans">
                  {wordContent}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        {lastImportStats && (
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-yellow-500/5" />
            <CardHeader className="relative z-10 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
              <CardTitle className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                <div className="bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 p-2 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                Last Import Summary
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300 mt-1">
                Import completed on {new Date(lastImportStats.importDate).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="group p-5 border border-gray-200/50 dark:border-gray-700/50 rounded-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 hover:shadow-lg transition-all duration-200 hover:scale-105 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-emerald-500/0 group-hover:from-green-500/5 group-hover:to-emerald-500/5 transition-opacity duration-300" />
                  <div className="text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent relative z-10">{lastImportStats.newRecords}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 relative z-10 font-medium">New Records</div>
                </div>
                <div className="group p-5 border border-gray-200/50 dark:border-gray-700/50 rounded-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 hover:shadow-lg transition-all duration-200 hover:scale-105 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/5 group-hover:to-cyan-500/5 transition-opacity duration-300" />
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent relative z-10">{lastImportStats.updatedRecords}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 relative z-10 font-medium">Updated Records</div>
                </div>
                <div className="group p-5 border border-gray-200/50 dark:border-gray-700/50 rounded-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 hover:shadow-lg transition-all duration-200 hover:scale-105 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/5 group-hover:to-pink-500/5 transition-opacity duration-300" />
                  <div className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent relative z-10">{lastImportStats.totalRecords}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 relative z-10 font-medium">Total Records</div>
                </div>
                <div className="group p-5 border border-gray-200/50 dark:border-gray-700/50 rounded-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 hover:shadow-lg transition-all duration-200 hover:scale-105 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-amber-500/0 group-hover:from-orange-500/5 group-hover:to-amber-500/5 transition-opacity duration-300" />
                  <div className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent relative z-10">{totalRecords}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 relative z-10 font-medium">Current Total</div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-sm text-green-900 dark:text-green-100">
                  <strong>✓ Data saved permanently.</strong> All records are stored in the app and will persist across sessions.
                  {importMode === "append" && " Perfect for monthly customer data updates!"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Import;
