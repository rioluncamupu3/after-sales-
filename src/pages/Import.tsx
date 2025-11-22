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
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
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

    // Check file size (warn if very large)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 100) {
      toast.info(`Very large file detected (${fileSizeMB.toFixed(1)}MB). This will be processed and saved directly to cloud storage. Processing may take a few minutes...`);
    } else if (fileSizeMB > 50) {
      toast.warning(`Large file detected (${fileSizeMB.toFixed(1)}MB). Processing may take a moment...`);
    }

    setSelectedFile(file);
    setExcelData(null);
    setWordContent(null);
    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: 0 });

    try {
      if (fileExtension === "xlsx" || fileExtension === "xls") {
        await handleExcelFile(file);
      } else if (fileExtension === "docx" || fileExtension === "doc") {
        await handleWordFile(file);
      }
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error("Error processing file. Please try again.");
    } finally {
      setIsProcessing(false);
      setProcessingProgress({ current: 0, total: 0 });
    }
  };

  // Helper function to save data in batches to avoid storage quota issues
  const saveDataInBatches = async (data: RawData[], batchSize: number) => {
    // If Supabase is configured, save directly there (no localStorage limit)
    const { isSupabaseConfigured } = await import('@/lib/supabase-client');
    const { api } = await import('@/lib/api-service');
    const isSupabase = isSupabaseConfigured();
    
    if (isSupabase) {
      // Save all at once to Supabase (it can handle large datasets, even 100MB+ files)
      try {
        console.log(`Saving ${data.length} records (${(JSON.stringify(data).length / 1024 / 1024).toFixed(2)}MB) directly to Supabase...`);
        setProcessingProgress({ current: 90, total: 100 });
        await api.setRawData(data);
        console.log('Successfully saved to Supabase');
        setProcessingProgress({ current: 95, total: 100 });
        
        // Only save a small subset to localStorage for offline access (last 1000 records)
        const localStorageSubset = data.slice(-1000);
        try {
          const subsetJson = JSON.stringify(localStorageSubset);
          if (subsetJson.length < 4 * 1024 * 1024) { // Only if subset is < 4MB
            localStorage.setItem(STORAGE_KEYS.RAW_DATA, subsetJson);
            console.log('Saved last 1000 records to localStorage for offline access');
          } else {
            console.log('Subset too large for localStorage, skipping local cache');
          }
        } catch (localError: any) {
          // If localStorage fails, that's okay - data is in Supabase
          console.warn('Could not save to localStorage, but data is in Supabase:', localError);
        }
        setProcessingProgress({ current: 100, total: 100 });
        return;
      } catch (error) {
        console.error('Error saving to Supabase:', error);
        toast.error('Error saving to cloud storage. Please check your Supabase configuration.');
        // Fall through to localStorage fallback
      }
    }
    
    // Fallback: Save to localStorage (for when Supabase is not configured)
    // For very large datasets, we'll only keep a subset in localStorage
    const localStorageLimit = 2000; // Keep max 2000 records in localStorage
    const dataToStore = data.length > localStorageLimit ? data.slice(-localStorageLimit) : data;
    
    try {
      await setStorageItem(STORAGE_KEYS.RAW_DATA, dataToStore);
      if (data.length > localStorageLimit) {
        toast.warning(`Large dataset (${data.length} records). Only keeping last ${localStorageLimit} in localStorage. Please configure Supabase for full data storage.`);
      }
    } catch (error: any) {
      if (error.name === 'QuotaExceededError' || error.code === 22) {
        // If still failing, try saving even smaller subset
        const smallerSubset = data.slice(-500);
        try {
          await setStorageItem(STORAGE_KEYS.RAW_DATA, smallerSubset);
          toast.warning(`Storage limit reached. Only keeping last 500 records. Please configure Supabase for full data storage.`);
        } catch (finalError) {
          toast.error('Storage limit exceeded. Please clear browser cache or configure Supabase for cloud storage.');
          throw finalError;
        }
      } else {
        throw error;
      }
    }
  };

  const handleExcelFile = async (file: File) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        setProcessingProgress({ current: 0, total: 100 });
        
        // Read file with options optimized for large files
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        setProcessingProgress({ current: 10, total: 100 });
        
        // Use streaming options for large files
        const fileSizeMB = file.size / (1024 * 1024);
        const readOptions: XLSX.ParsingOptions = {
          type: "array",
          cellDates: false, // Disable date parsing for performance
          cellNF: false, // Disable number format parsing
          cellText: false, // Disable text formatting
          dense: false, // Use sparse mode for memory efficiency
        };
        
        if (fileSizeMB > 50) {
          // For very large files, use more aggressive memory-saving options
          readOptions.sheetStubs = true; // Skip empty cells
        }
        
        setProcessingProgress({ current: 20, total: 100 });
        const workbook = XLSX.read(data, readOptions);
        setProcessingProgress({ current: 40, total: 100 });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON - use optimized options for large files
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          defval: "",
          raw: fileSizeMB <= 50, // Only use raw values for smaller files
        });
        setProcessingProgress({ current: 60, total: 100 });

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

        // Process data in batches to avoid memory issues
        const importTimestamp = new Date().toISOString();
        const validRows = rows.filter(row => row[accountNumberIdx]); // Only rows with account number
        const BATCH_SIZE = 1000; // Process 1000 rows at a time
        
        setProcessingProgress({ current: 0, total: validRows.length });
        
        // Process and transform rows in batches
        const newRawData: RawData[] = [];
        for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
          const batch = validRows.slice(i, i + BATCH_SIZE);
          const batchData = batch.map((row, idx) => {
            const globalIdx = i + idx;
            // Extract and clean values
            const groupNameValue = groupNameIdx >= 0 ? String(row[groupNameIdx] || "").trim() : "";
            const ownerNameValue = ownerNameIdx >= 0 ? String(row[ownerNameIdx] || "").trim() : "";
            const angazaIdValue = angazaIdIdx >= 0 ? String(row[angazaIdIdx] || "").trim() : "";
            const regDateValue = regDateIdx >= 0 ? String(row[regDateIdx] || "").trim() : "";
            const districtValue = districtIdx >= 0 ? String(row[districtIdx] || "").trim() : "";
            
            return {
              id: `${Date.now()}-${globalIdx}`,
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
          newRawData.push(...batchData);
          setProcessingProgress({ current: Math.min(i + BATCH_SIZE, validRows.length), total: validRows.length });
          
          // Allow UI to update
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Get existing data (from Supabase if available, otherwise localStorage)
        const { isSupabaseConfigured } = await import('@/lib/supabase-client');
        const { api } = await import('@/lib/api-service');
        const isSupabase = isSupabaseConfigured();
        
        const existingRawData = isSupabase 
          ? ((await api.getRawData()) || [])
          : ((await getStorageItem<RawData[]>(STORAGE_KEYS.RAW_DATA)) || []);
        let updatedRawData: RawData[] = [];
        let newRecords = 0;
        let updatedRecords = 0;

        // Process merge logic in batches to avoid memory issues
        if (importMode === "replace") {
          // Replace all existing data - use safe replace function
          updatedRawData = newRawData;
          newRecords = newRawData.length;
          updatedRecords = 0;
          
          // Use safe replace function that upserts first, then deletes old records
          // This ensures data is never lost
          const { isSupabaseConfigured } = await import('@/lib/supabase-client');
          const { api } = await import('@/lib/api-service');
          const isSupabase = isSupabaseConfigured();
          
          if (isSupabase) {
            try {
              console.log(`Replacing all data with ${newRawData.length} records...`);
              await api.replaceRawData(newRawData);
              console.log('Successfully replaced data in Supabase');
              
              // Also save subset to localStorage for offline access
              const localStorageSubset = newRawData.slice(-1000);
              try {
                const subsetJson = JSON.stringify(localStorageSubset);
                if (subsetJson.length < 4 * 1024 * 1024) {
                  localStorage.setItem(STORAGE_KEYS.RAW_DATA, subsetJson);
                }
              } catch (localError) {
                console.warn('Could not save to localStorage, but data is in Supabase:', localError);
              }
            } catch (error) {
              console.error('Error replacing data in Supabase:', error);
              // Fallback to localStorage
              await saveDataInBatches(updatedRawData, BATCH_SIZE);
            }
          } else {
            // Fallback to localStorage
            await saveDataInBatches(updatedRawData, BATCH_SIZE);
          }
        } else if (importMode === "append") {
          // Append only - don't update existing records
          updatedRawData = [...existingRawData];
          const toAdd: RawData[] = [];
          
          for (const newItem of newRawData) {
            const exists = updatedRawData.some(
              item => item.accountNumber === newItem.accountNumber
            );
            if (!exists) {
              updatedRawData.push(newItem);
              toAdd.push(newItem);
              newRecords++;
            }
          }
          
          // Save only new items in batches
          if (toAdd.length > 0) {
            await saveDataInBatches(updatedRawData, BATCH_SIZE);
          }
        } else {
          // Update mode (default) - update existing, add new
          updatedRawData = [...existingRawData];
          const accountMap = new Map(updatedRawData.map(item => [item.accountNumber, item]));
          
          for (const newItem of newRawData) {
            const existing = accountMap.get(newItem.accountNumber);
            if (existing) {
              const index = updatedRawData.findIndex(item => item.id === existing.id);
              if (index >= 0) {
                updatedRawData[index] = newItem;
                updatedRecords++;
              }
            } else {
              updatedRawData.push(newItem);
              accountMap.set(newItem.accountNumber, newItem);
              newRecords++;
            }
          }
          
          // Save in batches
          await saveDataInBatches(updatedRawData, BATCH_SIZE);
        }

        setTotalRecords(updatedRawData.length);
        setLastImportStats({
          newRecords,
          updatedRecords,
          totalRecords: updatedRawData.length,
          importDate: importTimestamp,
        });
        setExcelData({ headers, rows: rows.slice(0, 100) }); // Only show first 100 rows in preview
        
        const modeText = importMode === "replace" ? "replaced" : importMode === "append" ? "added (append only)" : "imported";
        // fileSizeMB is already declared earlier in this scope (line 183)
        const successMessage = fileSizeMB > 50
          ? `Successfully ${modeText} ${newRawData.length} records. Data saved to cloud storage. New: ${newRecords}, Updated: ${updatedRecords}, Total: ${updatedRawData.length}`
          : `Successfully ${modeText} ${newRawData.length} records. New: ${newRecords}, Updated: ${updatedRecords}, Total: ${updatedRawData.length}`;
        
        toast.success(successMessage, { duration: 5000 });
        setProcessingProgress({ current: 100, total: 100 });
      } catch (error: any) {
        console.error("Error parsing Excel:", error);
        const errorMessage = error?.message?.includes('memory') || error?.message?.includes('quota')
          ? "File is too large to process. Please split the file into smaller chunks or ensure Supabase is configured."
          : error?.message || "Error parsing Excel file";
        toast.error(errorMessage);
        setProcessingProgress({ current: 0, total: 0 });
      } finally {
        setIsProcessing(false);
      }
    };
    
    // Handle file reading errors
    reader.onerror = () => {
      toast.error("Error reading file. The file may be corrupted or too large.");
      setIsProcessing(false);
      setProcessingProgress({ current: 0, total: 0 });
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
              <div className="mt-4 space-y-3">
                <div className="p-4 border border-orange-200 dark:border-orange-800 rounded-xl bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    {getFileIcon()}
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{selectedFile.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  {!isProcessing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                      className="hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {isProcessing && (
                  <div className="p-4 border border-blue-200 dark:border-blue-800 rounded-xl bg-gradient-to-r from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        Processing file... Please wait
                      </p>
                    </div>
                    {processingProgress.total > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                          <span>Processing rows...</span>
                          <span>{processingProgress.current} / {processingProgress.total}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Large files are processed in batches and saved directly to cloud storage.
                    </p>
                  </div>
                )}
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
