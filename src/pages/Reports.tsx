import { useMemo, useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { MaintenanceCase, SparePart } from "@/lib/data-models";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { Download, X, Calendar, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx-js-style";
import { toast } from "sonner";

type BrandingOptions = {
  headerRow: number;
  totalRows?: number[];
  columnWidths?: number[];
  titleRows?: number[];
  accentColor?: string;
  applyAutoFilter?: boolean;
  freezePane?: { xSplit?: number; ySplit?: number } | false;
  zebraFills?: string[];
  headerPalette?: string[];
  heroFill?: string;
  subtitleFill?: string;
};

const baseBorder = { style: "thin", color: { rgb: "FFE2E8F0" } };

const applyExcelBranding = (sheet: XLSX.WorkSheet, options: BrandingOptions) => {
  const ref = sheet["!ref"];
  if (!ref) return;

  const range = XLSX.utils.decode_range(ref);
  const headerRow = options.headerRow;
  const totalRowSet = new Set(options.totalRows ?? []);
  const titleRowSet = new Set(options.titleRows ?? []);
  const titleRowOrder = new Map<number, number>();
  Array.from(titleRowSet)
    .sort((a, b) => a - b)
    .forEach((rowIndex, idx) => titleRowOrder.set(rowIndex, idx));
  const accent = options.accentColor ?? "FF7C3AED";
  const zebraFills = options.zebraFills ?? ["FFF2F7FF", "FFE6F0FF"];
  const headerPalette =
    options.headerPalette && options.headerPalette.length > 0
      ? options.headerPalette
      : [accent];
  const heroFill = options.heroFill ?? accent;
  const subtitleFill = options.subtitleFill ?? "FFFFFFFF";

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFFFF" }, sz: 12 },
    alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
    border: { top: baseBorder, bottom: baseBorder, left: baseBorder, right: baseBorder },
  };

  const dataRowStyles = zebraFills.map((fill) => ({
    font: { color: { rgb: "FF111827" }, sz: 11 },
    alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
    fill: { patternType: "solid" as const, fgColor: { rgb: fill } },
    border: { top: baseBorder, bottom: baseBorder, left: baseBorder, right: baseBorder },
  }));

  const totalStyle = {
    font: { bold: true, color: { rgb: "FF0F172A" } },
    alignment: { horizontal: "center" as const, vertical: "center" as const },
    fill: { patternType: "solid" as const, fgColor: { rgb: "FFFDE68A" } },
    border: { top: baseBorder, bottom: baseBorder, left: baseBorder, right: baseBorder },
  };

  const titleStyle = {
    font: { bold: true, sz: 16, color: { rgb: accent } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
  };

  const columnCount = range.e.c - range.s.c + 1;
  if (options.columnWidths?.length) {
    sheet["!cols"] = options.columnWidths.map((wch) => ({ wch }));
  } else {
    sheet["!cols"] = Array.from({ length: columnCount }, () => ({ wch: 18 }));
  }

  const freezePane =
    options.freezePane === false
      ? null
      : {
          xSplit: options.freezePane?.xSplit ?? 0,
          ySplit: options.freezePane?.ySplit ?? headerRow + 1,
        };

  if (freezePane) {
    sheet["!freeze"] = {
      xSplit: freezePane.xSplit,
      ySplit: freezePane.ySplit,
      topLeftCell: XLSX.utils.encode_cell({
        r: freezePane.ySplit,
        c: freezePane.xSplit,
      }),
      activePane: "bottomLeft",
      state: "frozen",
    };
  }

  if (options.applyAutoFilter !== false) {
    sheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { c: range.s.c, r: headerRow },
        e: { c: range.e.c, r: range.e.r },
      }),
    };
  }

  const rowMeta: XLSX.RowInfo[] = sheet["!rows"] ?? [];

  if (titleRowSet.size) {
    titleRowSet.forEach((rowIdx, idx) => {
      rowMeta[rowIdx] = {
        ...(rowMeta[rowIdx] ?? {}),
        hpt: idx === 0 ? 30 : 22,
      };
    });
    sheet["!rows"] = rowMeta;
  }

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[cellRef];
      if (!cell) continue;

      if (titleRowSet.has(r)) {
        const titleIdx = titleRowOrder.get(r) ?? 0;
        const fillColor = titleIdx === 0 ? heroFill : subtitleFill;
        const fontColor = titleIdx === 0 ? "FFFFFFFF" : accent;
        cell.s = {
          ...cell.s,
          ...titleStyle,
          font: {
            ...titleStyle.font,
            sz: titleIdx === 0 ? 17 : 12,
            color: { rgb: fontColor },
          },
          fill: { patternType: "solid", fgColor: { rgb: fillColor } },
        };
        continue;
      }

      if (r === headerRow) {
        const paletteColor = headerPalette[(c - range.s.c) % headerPalette.length];
        cell.s = {
          ...cell.s,
          ...headerStyle,
          fill: { patternType: "solid", fgColor: { rgb: paletteColor } },
        };
        continue;
      }

      if (r < headerRow) continue;

      if (totalRowSet.has(r)) {
        cell.s = { ...cell.s, ...totalStyle };
      } else {
        const zebraIndex = (r - headerRow - 1) % dataRowStyles.length;
        const baseStyle = dataRowStyles[zebraIndex];
        const clonedStyle = {
          ...baseStyle,
          alignment: { ...baseStyle.alignment },
        };
        if (c === range.s.c) {
          clonedStyle.alignment = { ...clonedStyle.alignment, horizontal: "left" };
        }
        cell.s = { ...cell.s, ...clonedStyle };
      }
    }
  }
};

type BuildSheetMatrixOptions = {
  title: string;
  subtitle?: string;
  headers: (string | number)[];
  rows: (string | number)[][];
  extraRows?: (string | number)[][];
};

type SheetMatrix = {
  data: (string | number)[][];
  headerRowIndex: number;
  merges: { s: { r: number; c: number }; e: { r: number; c: number } }[];
  titleRows: number[];
};

const buildSheetMatrix = ({
  title,
  subtitle,
  headers,
  rows,
  extraRows = [],
}: BuildSheetMatrixOptions): SheetMatrix => {
  const columnCount = headers.length;
  const padRow = (row: (string | number)[]) => {
    if (row.length >= columnCount) return row;
    return row.concat(Array(columnCount - row.length).fill(""));
  };

  const bannerRows = [
    padRow([title]),
    padRow([subtitle ?? ""]),
    Array(columnCount).fill(""),
  ];

  const paddedExtras = extraRows.map(padRow);
  const data = [...bannerRows, ...paddedExtras, headers, ...rows];
  const headerRowIndex = bannerRows.length + paddedExtras.length;
  const titleRows = subtitle ? [0, 1] : [0];
  const merges =
    columnCount > 1
      ? [
          { s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: columnCount - 1 } },
        ]
      : [];

  return { data, headerRowIndex, merges, titleRows };
};

            


const tableHeaderClass =
  "h-12 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200 whitespace-nowrap";

const Reports = () => {
  const [allCases, setAllCases] = useState<MaintenanceCase[]>([]);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const casesData = (await getStorageItem<MaintenanceCase[]>(STORAGE_KEYS.CASES)) || [];
      const partsData = (await getStorageItem<SparePart[]>(STORAGE_KEYS.SPARE_PARTS)) || [];
      const usersData = (await getStorageItem<any[]>(STORAGE_KEYS.USERS)) || [];
      setAllCases(casesData);
      setParts(partsData);
      setUsers(usersData);
    };
    loadData();
  }, []);

  const userRole = localStorage.getItem("userRole");
  const isAdmin = userRole === "admin";

  // Filter cases based on date range
  const cases = useMemo(() => {
    if (!startDate && !endDate) {
      return allCases;
    }

    return allCases.filter((caseItem) => {
      const caseDate = new Date(caseItem.dateReceivedAtSC);
      
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return caseDate >= start && caseDate <= end;
      } else if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        return caseDate >= start;
      } else if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return caseDate <= end;
      }
      
      return true;
    });
  }, [allCases, startDate, endDate]);

  const handleClearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setShowFilters(false);
    toast.success("Filters cleared");
  };

  // Get all unique product names from cases
  const allProductNames = useMemo(() => {
    const productSet = new Set<string>();
    cases.forEach((caseItem) => {
      const productName = caseItem.productName?.trim();
      if (productName) {
        productSet.add(productName);
      }
    });
    return Array.from(productSet).sort();
  }, [cases]);

  // Get technician performance data
  const technicianPerformance = useMemo(() => {
    const techMap = new Map<string, {
      id: string;
      name: string;
      serviceCenter?: string;
      totalCases: number;
      deliveredCases: number;
      pendingCases: number;
      warrantyValid: number;
      warrantyExpired: number;
      sparePartsUsed: number;
      casesByMonth: Record<string, number>;
      productsByName: Map<string, number>; // productName -> count
    }>();

    cases.forEach((caseItem) => {
      const techId = caseItem.technicianId;
      if (!techMap.has(techId)) {
        const user = users.find((u) => u.id === techId);
        const serviceCenter = (user as any)?.serviceCenter || "-";
        techMap.set(techId, {
          id: techId,
          name: caseItem.technicianName,
          serviceCenter: serviceCenter,
          totalCases: 0,
          deliveredCases: 0,
          pendingCases: 0,
          warrantyValid: 0,
          warrantyExpired: 0,
          sparePartsUsed: 0,
          casesByMonth: {},
          productsByName: new Map(),
        });
      }

      const tech = techMap.get(techId)!;
      tech.totalCases++;
      
      if (caseItem.maintenanceStatus === "Delivered") {
        tech.deliveredCases++;
      } else if (caseItem.maintenanceStatus === "Pending") {
        tech.pendingCases++;
      } else if (caseItem.maintenanceStatus === "Received") {
        tech.pendingCases++; // Received cases are also considered pending
      }

      if (caseItem.warrantyStatus === "Valid") {
        tech.warrantyValid++;
      } else {
        tech.warrantyExpired++;
      }

      if (caseItem.sparePartsUsed) {
        tech.sparePartsUsed += caseItem.sparePartsUsed.reduce(
          (sum, p) => sum + p.quantity,
          0
        );
      }

      // Count products by name (from Product Name field)
      const productName = caseItem.productName?.trim() || "Unknown";
      tech.productsByName.set(productName, (tech.productsByName.get(productName) || 0) + 1);

      // Count by month
      const month = new Date(caseItem.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
      tech.casesByMonth[month] = (tech.casesByMonth[month] || 0) + 1;
    });

    return Array.from(techMap.values()).map(tech => ({
      ...tech,
      productsByName: tech.productsByName, // Keep as Map for easy lookup
    })).sort((a, b) => b.totalCases - a.totalCases);
  }, [cases, users]);

  // Spare parts usage summary
  const sparePartsSummary = useMemo(() => {
    const partsMap = new Map<string, { name: string; used: number; remaining: number }>();

    // Get remaining from inventory
    parts.forEach((part) => {
      partsMap.set(part.id, {
        name: part.name,
        used: part.totalStock - part.remainingStock,
        remaining: part.remainingStock,
      });
    });

    // Add usage from cases
    cases.forEach((caseItem) => {
      if (caseItem.sparePartsUsed) {
        caseItem.sparePartsUsed.forEach((usedPart) => {
          const existing = partsMap.get(usedPart.partId);
          if (existing) {
            existing.used += usedPart.quantity;
          }
        });
      }
    });

    return Array.from(partsMap.values()).sort((a, b) => b.used - a.used);
  }, [parts, cases]);

  // District performance
  const districtPerformance = useMemo(() => {
    const districtMap = new Map<string, {
      district: string;
      totalCases: number;
      delivered: number;
      pending: number;
    }>();

    cases.forEach((caseItem) => {
      const district = caseItem.district;
      if (!districtMap.has(district)) {
        districtMap.set(district, {
          district,
          totalCases: 0,
          delivered: 0,
          pending: 0,
        });
      }

      const stats = districtMap.get(district)!;
      stats.totalCases++;
      if (caseItem.maintenanceStatus === "Delivered") {
        stats.delivered++;
      } else if (caseItem.maintenanceStatus === "Pending" || caseItem.maintenanceStatus === "Received") {
        stats.pending++;
      }
    });

    return Array.from(districtMap.values()).sort((a, b) => b.totalCases - a.totalCases);
  }, [cases]);

  const handleDownloadPDF = async () => {
    try {
      toast.info("Generating PDF...");
      
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const pageWidth = pdfWidth - (margin * 2);
      let yPosition = margin;

      // Helper function to add new page if needed
      const checkPageBreak = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pdfHeight - margin) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Helper function to draw table
      const drawTable = (
        title: string,
        headers: string[],
        rows: string[][],
        colWidths: number[]
      ) => {
        checkPageBreak(20);
        
        // Table title
        pdf.setFontSize(14);
        pdf.setFont(undefined, "bold");
        pdf.text(title, margin, yPosition);
        yPosition += 8;

        // Table header
        pdf.setFontSize(8);
        pdf.setFont(undefined, "bold");
        let xPos = margin;
        headers.forEach((header, index) => {
          // Dark header background
          pdf.setFillColor(33, 116, 217); // Blue color
          pdf.rect(xPos, yPosition - 5, colWidths[index], 8, "FD");
          pdf.setTextColor(255, 255, 255);
          // Use smaller font and better text positioning for headers
          pdf.text(header, xPos + 1, yPosition - 1, { 
            maxWidth: colWidths[index] - 2, 
            align: "left",
            lineHeightFactor: 1.2
          });
          pdf.setTextColor(0, 0, 0);
          xPos += colWidths[index];
        });
        yPosition += 8;

        // Table rows
        pdf.setFontSize(8);
        pdf.setFont(undefined, "normal");
        rows.forEach((row, rowIndex) => {
          checkPageBreak(7);
          
          // Alternate row colors
          if (rowIndex % 2 === 0) {
            pdf.setFillColor(245, 245, 245);
            pdf.rect(margin, yPosition - 5, pageWidth, 7, "F");
          }
          
          xPos = margin;
          row.forEach((cell, colIndex) => {
            pdf.rect(xPos, yPosition - 5, colWidths[colIndex], 7, "S");
            pdf.text(cell, xPos + 1, yPosition - 1, { 
              maxWidth: colWidths[colIndex] - 2, 
              align: "left",
              lineHeightFactor: 1.2
            });
            xPos += colWidths[colIndex];
          });
          yPosition += 7;
        });
        yPosition += 5;
      };

      // Helper function to draw pie chart using canvas and convert to image
      const drawPieChart = async (
        title: string,
        data: Array<{ label: string; value: number; color: [number, number, number] }>,
        x: number,
        y: number,
        radius: number = 25
      ): Promise<number> => {
        checkPageBreak(radius * 2 + 50);
        
        // Calculate total for percentages
        const total = data.reduce((sum, item) => sum + item.value, 0);
        if (total === 0) return y;
        
        // Chart title
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'bold');
        pdf.text(title, x, y - radius - 8, { align: 'center' });
        
        // Create canvas to draw pie chart
        const canvas = document.createElement('canvas');
        const cssSize = radius * 2 * 3.7795; // Convert mm to pixels (1mm = 3.7795px at 96dpi)
        const scale = Math.max((typeof window !== "undefined" ? window.devicePixelRatio : 2) || 2, 2);
        canvas.width = cssSize * scale;
        canvas.height = cssSize * scale;
        canvas.style.width = `${cssSize}px`;
        canvas.style.height = `${cssSize}px`;
        
        // Temporarily add canvas to DOM (hidden) to ensure proper rendering
        canvas.style.position = 'absolute';
        canvas.style.left = '-9999px';
        canvas.style.top = '-9999px';
        document.body.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          document.body.removeChild(canvas);
          return y;
        }
        
        ctx.scale(scale, scale);
        
        // Set canvas background to white
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, cssSize, cssSize);
        
        const centerX = cssSize / 2;
        const centerY = cssSize / 2;
        const chartRadius = radius * 3.7795;
        
        // Draw pie slices
        let currentAngle = -90; // Start from top (12 o'clock)
        
        data.forEach((item) => {
          if (item.value === 0) return;
          
          const sliceAngle = (item.value / total) * 360;
          const startAngle = currentAngle;
          const endAngle = currentAngle + sliceAngle;
          
          // Draw slice
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, chartRadius, (startAngle * Math.PI) / 180, (endAngle * Math.PI) / 180);
          ctx.closePath();
          ctx.fillStyle = `rgb(${item.color[0]}, ${item.color[1]}, ${item.color[2]})`;
          ctx.fill();
          
          currentAngle += sliceAngle;
        });
        
        // Wait a bit to ensure canvas is fully rendered
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Convert canvas to image and add to PDF
        try {
          const imageData = canvas.toDataURL('image/png', 1.0);
          if (imageData && imageData !== 'data:,') {
            const imgWidth = radius * 2;
            const imgHeight = radius * 2;
            pdf.addImage(imageData, 'PNG', x - radius, y - radius, imgWidth, imgHeight);
          }
        } catch (error) {
          console.error('Error converting canvas to image:', error);
        } finally {
          // Remove canvas from DOM
          if (canvas.parentNode) {
            document.body.removeChild(canvas);
          }
        }
        
        // Draw legend below the chart
        const legendX = x - radius;
        let legendY = y + radius + 8;
        const boxSize = 3;
        const legendItemHeight = 5;
        const maxLegendWidth = radius * 2;
        
        // Filter out zero values
        const validData = data.filter(item => item.value > 0);
        
        // Determine if we need two columns (if more than 6 items)
        const needsColumns = validData.length > 6;
        const itemsPerColumn = needsColumns ? Math.ceil(validData.length / 2) : validData.length;
        const columnWidth = needsColumns ? maxLegendWidth / 2 : maxLegendWidth;
        
        let currentColumn = 0;
        let currentRow = 0;
        
        validData.forEach((item) => {
          const percentage = ((item.value / total) * 100).toFixed(1);
          
          // Calculate position based on column layout
          const itemX = legendX + (currentColumn * columnWidth);
          const itemY = legendY + (currentRow * legendItemHeight);
          
          // Color box
          pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
          pdf.rect(itemX, itemY - boxSize / 2, boxSize, boxSize, 'FD');
          
          // Label
          pdf.setFontSize(8);
          pdf.setFont(undefined, 'normal');
          pdf.setTextColor(0, 0, 0);
          const labelText = `${item.label}: ${item.value} (${percentage}%)`;
          pdf.text(labelText, itemX + boxSize + 2, itemY, { 
            maxWidth: columnWidth - boxSize - 4,
            align: 'left'
          });
          
          currentRow++;
          if (currentRow >= itemsPerColumn) {
            currentRow = 0;
            currentColumn++;
          }
        });
        
        // Calculate final Y position based on legend height
        const legendHeight = Math.ceil(validData.length / (needsColumns ? 2 : 1)) * legendItemHeight;
        return y + radius + legendHeight + 15;
      };

      // Helper function to draw table with totals row
      const drawTableWithTotals = (
        title: string,
        headers: string[],
        rows: string[][],
        colWidths: number[],
        totalsRow: string[]
      ) => {
        checkPageBreak(25);
        
        // Table title
        pdf.setFontSize(14);
        pdf.setFont(undefined, "bold");
        pdf.text(title, margin, yPosition);
        yPosition += 8;

        // Table header
        pdf.setFontSize(8);
        pdf.setFont(undefined, "bold");
        let xPos = margin;
        headers.forEach((header, index) => {
          // Dark header background
          pdf.setFillColor(33, 116, 217); // Blue color
          pdf.rect(xPos, yPosition - 5, colWidths[index], 8, "FD");
          pdf.setTextColor(255, 255, 255);
          // Use smaller font and better text positioning for headers
          pdf.text(header, xPos + 1, yPosition - 1, { 
            maxWidth: colWidths[index] - 2, 
            align: "left",
            lineHeightFactor: 1.2
          });
          pdf.setTextColor(0, 0, 0);
          xPos += colWidths[index];
        });
        yPosition += 8;

        // Table rows
        pdf.setFontSize(8);
        pdf.setFont(undefined, "normal");
        rows.forEach((row, rowIndex) => {
          checkPageBreak(7);
          
          // Alternate row colors
          if (rowIndex % 2 === 0) {
            pdf.setFillColor(245, 245, 245);
            pdf.rect(margin, yPosition - 5, pageWidth, 7, "F");
          }
          
          xPos = margin;
          row.forEach((cell, colIndex) => {
            pdf.rect(xPos, yPosition - 5, colWidths[colIndex], 7, "S");
            pdf.text(cell, xPos + 1, yPosition - 1, { 
              maxWidth: colWidths[colIndex] - 2, 
              align: "left",
              lineHeightFactor: 1.2
            });
            xPos += colWidths[colIndex];
          });
          yPosition += 7;
        });
        
        // Totals row
        checkPageBreak(8);
        yPosition += 2; // Small gap before totals
        pdf.setFontSize(8);
        pdf.setFont(undefined, "bold");
        xPos = margin;
        totalsRow.forEach((cell, colIndex) => {
          // Dark background for totals row
          pdf.setFillColor(200, 200, 200); // Gray color
          pdf.rect(xPos, yPosition - 5, colWidths[colIndex], 8, "FD");
          pdf.setTextColor(0, 0, 0);
          pdf.text(cell, xPos + 1, yPosition - 1, { 
            maxWidth: colWidths[colIndex] - 2, 
            align: "left",
            lineHeightFactor: 1.2
          });
          xPos += colWidths[colIndex];
        });
        yPosition += 8;
        yPosition += 5;
      };

      // Get logo from localStorage
      const appLogo = localStorage.getItem("appLogo");
      
      // Header with Logo
      if (appLogo) {
        try {
          // Create an image element to get dimensions and maintain aspect ratio
          const img = new Image();
          img.src = appLogo;
          
          // Wait for image to load, then add to PDF
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              console.warn("Logo loading timeout, continuing without logo");
              resolve();
            }, 2000); // 2 second timeout
            
            img.onload = () => {
              clearTimeout(timeout);
              try {
                // Calculate dimensions maintaining aspect ratio
                // Max height: 25mm, max width: 70mm (increased for better visibility)
                const maxHeight = 25;
                const maxWidth = 70;
                
                // Get original image dimensions
                const originalWidth = img.width;
                const originalHeight = img.height;
                const aspectRatio = originalWidth / originalHeight;
                
                // Calculate dimensions to fit within max bounds while maintaining aspect ratio
                let logoWidth = maxWidth;
                let logoHeight = maxWidth / aspectRatio;
                
                // If height exceeds max, scale based on height instead
                if (logoHeight > maxHeight) {
                  logoHeight = maxHeight;
                  logoWidth = maxHeight * aspectRatio;
                }
                
                // Center the logo horizontally on the page
                // pdfWidth is the full page width, so center is pdfWidth / 2
                // Logo X position = center of page - half of logo width
                const logoX = (pdfWidth / 2) - (logoWidth / 2);
                
                // Determine image format from data URL
                let format = 'PNG';
                if (appLogo.includes('data:image/jpeg') || appLogo.includes('data:image/jpg')) {
                  format = 'JPEG';
                } else if (appLogo.includes('data:image/png')) {
                  format = 'PNG';
                }
                
                // Add logo to PDF (centered)
                pdf.addImage(appLogo, format, logoX, yPosition, logoWidth, logoHeight);
                yPosition += logoHeight + 8; // Add spacing after logo
                resolve();
              } catch (error) {
                console.error("Error adding logo to PDF:", error);
                resolve(); // Continue without logo
              }
            };

            
            
            img.onerror = () => {
              clearTimeout(timeout);
              console.error("Error loading logo image");
              resolve(); // Continue without logo
            };
          });
        } catch (error) {
          console.error("Error processing logo for PDF:", error);
          // Continue without logo if there's an error
        }
      }
      
      pdf.setFontSize(20);
      pdf.setFont(undefined, "bold");
      pdf.text("Weekly Reports & Analytics", pdfWidth / 2, yPosition, { align: "center" });
      yPosition += 8;

      pdf.setFontSize(11);
      pdf.setFont(undefined, "normal");
      const dateStr = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      pdf.text(`Generated on: ${dateStr}`, pdfWidth / 2, yPosition, { align: "center" });
      yPosition += 6;
      
      // Show date range if filters are applied
      if (startDate || endDate) {
        let dateRangeText = "Date Range: ";
        if (startDate && endDate) {
          dateRangeText += `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
        } else if (startDate) {
          dateRangeText += `From ${startDate.toLocaleDateString()}`;
        } else if (endDate) {
          dateRangeText += `Until ${endDate.toLocaleDateString()}`;
        }
        pdf.setFontSize(10);
        pdf.text(dateRangeText, pdfWidth / 2, yPosition, { align: "center" });
        yPosition += 6;
      }
      yPosition += 4;

      // Summary Statistics
      pdf.setFontSize(12);
      pdf.setFont(undefined, "bold");
      pdf.text("Summary Statistics", margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont(undefined, "normal");
      pdf.text(`Total Cases: ${cases.length}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Total Technicians: ${technicianPerformance.length}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Total Districts: ${districtPerformance.length}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Total Spare Parts: ${sparePartsSummary.length}`, margin, yPosition);
      yPosition += 15;

      // Pie Charts Section - Single Unified Chart
      pdf.setFontSize(12);
      pdf.setFont(undefined, "bold");
      pdf.text("Data Visualization", margin, yPosition);
      yPosition += 10;

      // Calculate data for unified pie chart
      if (cases.length > 0) {
        checkPageBreak(80);
        
        // Get all unique maintenance statuses
        const statusCounts = new Map<string, number>();
        cases.forEach(c => {
          const status = c.maintenanceStatus || "Unknown";
          statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
        });
        
        // Create comprehensive data array with all statuses
        const allStatusData: Array<{ label: string; value: number; color: [number, number, number] }> = [];
        
        // Color palette for different statuses
        const statusColors: Record<string, [number, number, number]> = {
          "Delivered": [34, 197, 94],      // Green
          "Received": [251, 191, 36],      // Yellow
          "Pending": [239, 68, 68],        // Red
          "Unknown": [156, 163, 175]       // Gray
        };
        
        // Add all statuses to the chart
        statusCounts.forEach((value, status) => {
          const color = statusColors[status] || [168, 85, 247]; // Default purple
          allStatusData.push({
            label: status,
            value: value,
            color: color
          });
        });
        
        // Sort by value (descending) for better visualization
        allStatusData.sort((a, b) => b.value - a.value);
        
        // Draw single unified pie chart in the center
        const chartX = pdfWidth / 2;
        yPosition = await drawPieChart("Case Status Distribution", allStatusData, chartX, yPosition, 30);
        yPosition += 10;
      }

      // Technician Performance Table
      const techHeaders = ["Technician", "Service Center", "Total", "Delivered", "Pending", "Warranty Valid", "Warranty Expired", "Parts Used", ...allProductNames, "Success %"];
      // Adjusted column widths - base columns + product columns (12mm each) + success
      const baseColWidths = [28, 18, 10, 12, 12, 15, 17, 12];
      const productColWidths = allProductNames.map(() => 15); // 15mm per product column
      const techColWidths = [...baseColWidths, ...productColWidths, 12];
      
      // Calculate totals
      const totals = technicianPerformance.reduce((acc, tech) => {
        acc.totalCases += tech.totalCases;
        acc.deliveredCases += tech.deliveredCases;
        acc.pendingCases += tech.pendingCases;
        acc.warrantyValid += tech.warrantyValid;
        acc.warrantyExpired += tech.warrantyExpired;
        acc.sparePartsUsed += tech.sparePartsUsed;
        // Calculate product totals
        allProductNames.forEach(productName => {
          if (!acc.products) acc.products = {};
          acc.products[productName] = (acc.products[productName] || 0) + (tech.productsByName.get(productName) || 0);
        });
        return acc;
      }, {
        totalCases: 0,
        deliveredCases: 0,
        pendingCases: 0,
        warrantyValid: 0,
        warrantyExpired: 0,
        sparePartsUsed: 0,
        products: {} as Record<string, number>
      });
      
      // Calculate overall success rate
      const overallSuccessRate = totals.totalCases > 0
        ? ((totals.deliveredCases / totals.totalCases) * 100).toFixed(1)
        : "0";
      
      const techRows = technicianPerformance.map((tech) => {
        const successRate = tech.totalCases > 0
          ? ((tech.deliveredCases / tech.totalCases) * 100).toFixed(1)
          : "0";
        const productCounts = allProductNames.map(productName => 
          (tech.productsByName.get(productName) || 0).toString()
        );
        return [
          tech.name || "Unknown",
          tech.serviceCenter || "-",
          tech.totalCases.toString(),
          tech.deliveredCases.toString(),
          tech.pendingCases.toString(),
          tech.warrantyValid.toString(),
          tech.warrantyExpired.toString(),
          tech.sparePartsUsed.toString(),
          ...productCounts,
          `${successRate}%`
        ];
      });
      
      // Add totals row
      const productTotals = allProductNames.map(productName => 
        (totals.products?.[productName] || 0).toString()
      );
      const totalsRow = [
        "TOTAL",
        "-",
        totals.totalCases.toString(),
        totals.deliveredCases.toString(),
        totals.pendingCases.toString(),
        totals.warrantyValid.toString(),
        totals.warrantyExpired.toString(),
        totals.sparePartsUsed.toString(),
        ...productTotals,
        `${overallSuccessRate}%`
      ];
      
      drawTableWithTotals("Technician Performance", techHeaders, techRows, techColWidths, totalsRow);

      // District Performance Table
      const districtHeaders = ["District", "Total Cases", "Delivered", "Pending", "Delivery Rate %"];
      const districtColWidths = [50, 30, 30, 30, 35];
      
      // Calculate district totals
      const districtTotals = districtPerformance.reduce((acc, district) => {
        acc.totalCases += district.totalCases;
        acc.delivered += district.delivered;
        acc.pending += district.pending;
        return acc;
      }, {
        totalCases: 0,
        delivered: 0,
        pending: 0
      });
      
      // Calculate overall delivery rate
      const overallDeliveryRate = districtTotals.totalCases > 0
        ? ((districtTotals.delivered / districtTotals.totalCases) * 100).toFixed(1)
        : "0";
      
      const districtRows = districtPerformance.map((district) => {
        const deliveryRate = district.totalCases > 0
          ? ((district.delivered / district.totalCases) * 100).toFixed(1)
          : "0";
        return [
          district.district || "Unknown",
          district.totalCases.toString(),
          district.delivered.toString(),
          district.pending.toString(),
          `${deliveryRate}%`
        ];
      });
      
      // Add totals row for districts
      const districtTotalsRow = [
        "TOTAL",
        districtTotals.totalCases.toString(),
        districtTotals.delivered.toString(),
        districtTotals.pending.toString(),
        `${overallDeliveryRate}%`
      ];
      
      drawTableWithTotals("District Performance", districtHeaders, districtRows, districtColWidths, districtTotalsRow);

      // Spare Parts Usage Table
      const partsHeaders = ["Part Name", "Used", "Remaining", "Total", "Usage Rate %"];
      const partsColWidths = [70, 25, 30, 25, 30];
      
      // Calculate spare parts totals
      const partsTotals = sparePartsSummary.reduce((acc, part) => {
        const total = part.used + part.remaining;
        acc.used += part.used;
        acc.remaining += part.remaining;
        acc.total += total;
        return acc;
      }, {
        used: 0,
        remaining: 0,
        total: 0
      });
      
      // Calculate overall usage rate
      const overallUsageRate = partsTotals.total > 0
        ? ((partsTotals.used / partsTotals.total) * 100).toFixed(1)
        : "0";
      
      const partsRows = sparePartsSummary.map((part) => {
        const total = part.used + part.remaining;
        const usageRate = total > 0 ? ((part.used / total) * 100).toFixed(1) : "0";
        return [
          part.name || "Unknown",
          part.used.toString(),
          part.remaining.toString(),
          total.toString(),
          `${usageRate}%`
        ];
      });
      
      // Add totals row for spare parts
      const partsTotalsRow = [
        "TOTAL",
        partsTotals.used.toString(),
        partsTotals.remaining.toString(),
        partsTotals.total.toString(),
        `${overallUsageRate}%`
      ];
      
      drawTableWithTotals("Spare Parts Usage Summary", partsHeaders, partsRows, partsColWidths, partsTotalsRow);

      // Footer on last page
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          `Page ${i} of ${pageCount}`,
          pdfWidth / 2,
          pdfHeight - 10,
          { align: "center" }
        );
        pdf.setTextColor(0, 0, 0);
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `Weekly_Report_${timestamp}.pdf`;
      
      pdf.save(filename);
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF. Please try again.");
    }
  };

  const handleDownloadExcel = () => {
    try {
      toast.info("Generating Excel report...");
      
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      const deliveredCount = cases.filter(c => c.maintenanceStatus === "Delivered").length;
      const pendingCount = cases.length - deliveredCount;
      const warrantyValidCount = cases.filter(c => c.warrantyStatus === "Valid").length;
      const warrantyExpiredCount = cases.length - warrantyValidCount;
      const asPercentage = (value: number, total: number) =>
        total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
      
      // Summary Statistics Sheet
      const formattedDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const summaryHeaders = ["Metric", "Value", "Share of Total"];
      const percentDisplay = (value: number, total: number) =>
        total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0%";

      const summaryRows: (string | number)[][] = [
        ["Total Cases", cases.length, "100%"],
        ["Delivered Cases", deliveredCount, percentDisplay(deliveredCount, cases.length)],
        ["Pending Cases", pendingCount, percentDisplay(pendingCount, cases.length)],
        ["", "", ""],
        ["Warranty Valid", warrantyValidCount, percentDisplay(warrantyValidCount, cases.length)],
        ["Warranty Expired", warrantyExpiredCount, percentDisplay(warrantyExpiredCount, cases.length)],
        ["", "", ""],
        ["Technicians Covered", technicianPerformance.length, "—"],
        ["Districts Covered", districtPerformance.length, "—"],
        ["Spare Parts Tracked", sparePartsSummary.length, "—"],
      ];

      const summaryExtraRows: (string | number)[][] = [
        ["Generated On", formattedDate],
      ];

      if (startDate || endDate) {
        const rangeLabel =
          startDate && endDate
            ? `From ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
            : startDate
            ? `From ${startDate.toLocaleDateString()}`
            : `Until ${endDate?.toLocaleDateString()}`;
        summaryExtraRows.push(["Date Range", rangeLabel]);
      }

      const { data: summarySheetData, headerRowIndex: summaryHeaderRow, merges: summaryMerges, titleRows: summaryTitleRows } =
        buildSheetMatrix({
          title: "Reports & Analytics Overview",
          subtitle: "Executive summary snapshot",
          headers: summaryHeaders,
          rows: summaryRows,
          extraRows: summaryExtraRows,
        });

      const summaryNavLinks = [
        { label: "Technician Performance →", target: "#'Technician Performance'!A1" },
        { label: "District Performance →", target: "#'District Performance'!A1" },
        { label: "Spare Parts Usage →", target: "#'Spare Parts Usage'!A1" },
        { label: "Status Distribution →", target: "#'Status Distribution'!A1" },
        { label: "Executive Pivot →", target: "#'Executive Pivot'!A1" },
      ];

      const summaryTotalRowIndex = summaryHeaderRow + 1; // Total Cases row
      const summaryNavRowIndices: number[] = [];
      summaryNavLinks.forEach((link) => {
        summarySheetData.push([link.label, "Jump to sheet", ""]);
        summaryNavRowIndices.push(summarySheetData.length - 1);
      });

      const summarySheet = XLSX.utils.aoa_to_sheet(summarySheetData);
      summarySheet["!merges"] = [...(summarySheet["!merges"] ?? []), ...summaryMerges];
      applyExcelBranding(summarySheet, {
        headerRow: summaryHeaderRow,
        columnWidths: [34, 20, 18],
        titleRows: summaryTitleRows,
        accentColor: "FF8B5CF6",
        totalRows: [summaryTotalRowIndex],
        freezePane: { xSplit: 0, ySplit: summaryHeaderRow + 1 },
        headerPalette: ["FF8B5CF6", "FFEC4899", "FF0EA5E9"],
        heroFill: "FF5B21B6",
        subtitleFill: "FFEDE9FE",
        zebraFills: ["FFFDF4FF", "FFF7E8FF"],
      });

      summaryNavRowIndices.forEach((rowIdx, index) => {
        const labelCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
        const valueCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 1 });
        const target = summaryNavLinks[index].target;

        const labelCell = summarySheet[labelCellRef];
        if (labelCell) {
          labelCell.l = { Target: target, Tooltip: "Open sheet" };
          labelCell.s = {
            ...labelCell.s,
            font: { color: { rgb: "FF2563EB" }, underline: true, bold: true },
          };
        }

        const valueCell = summarySheet[valueCellRef];
        if (valueCell) {
          valueCell.l = { Target: target, Tooltip: "Open sheet" };
          valueCell.s = {
            ...valueCell.s,
            font: { color: { rgb: "FF2563EB" }, underline: true },
          };
        }
      });

      XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

      // Executive Pivot Sheet
      const pivotHeaders = [
        "District",
        "Delivered",
        "Pending",
        "Received",
        "Warranty Valid",
        "Warranty Expired",
        "Total Cases",
        "Delivery Rate %"
      ];

      const pivotPadRow = (row: (string | number)[]) => {
        if (row.length >= pivotHeaders.length) return row;
        return [...row, ...Array(pivotHeaders.length - row.length).fill("")];
      };

      const kpiRows: (string | number)[][] = [
        ["Total Cases", cases.length],
        ["Delivered Cases", deliveredCount],
        ["Pending Cases", pendingCount],
        ["Delivery Rate %", asPercentage(deliveredCount, cases.length)],
        ["Warranty Valid %", asPercentage(warrantyValidCount, cases.length)],
      ];

      const slaValidCases = cases.filter((c) => typeof c.slaDays === "number");
      if (slaValidCases.length > 0) {
        const avgSla =
          slaValidCases.reduce((sum, c) => sum + (c.slaDays || 0), 0) / slaValidCases.length;
        kpiRows.push(["Average SLA Days", Number(avgSla.toFixed(1))]);
      }

      const topTechnicians = [...technicianPerformance]
        .sort((a, b) => b.deliveredCases - a.deliveredCases)
        .slice(0, 3)
        .map((tech) => {
          const success =
            tech.totalCases > 0 ? Number(((tech.deliveredCases / tech.totalCases) * 100).toFixed(1)) : 0;
          return [tech.name || "Unknown", tech.totalCases, success];
        });

      if (topTechnicians.length === 0) {
        topTechnicians.push(["No technician data", "-", "-"]);
      }

      type PivotEntry = {
        delivered: number;
        pending: number;
        received: number;
        warrantyValid: number;
        warrantyExpired: number;
        total: number;
      };

      const districtPivot = cases.reduce<Map<string, PivotEntry>>((map, maintenanceCase) => {
        const key = maintenanceCase.district || "Unknown";
        if (!map.has(key)) {
          map.set(key, {
            delivered: 0,
            pending: 0,
            received: 0,
            warrantyValid: 0,
            warrantyExpired: 0,
            total: 0,
          });
        }
        const entry = map.get(key)!;
        if (maintenanceCase.maintenanceStatus === "Delivered") entry.delivered += 1;
        else if (maintenanceCase.maintenanceStatus === "Pending") entry.pending += 1;
        else entry.received += 1;

        if (maintenanceCase.warrantyStatus === "Valid") entry.warrantyValid += 1;
        else entry.warrantyExpired += 1;

        entry.total += 1;
        return map;
      }, new Map());

      const pivotRows = Array.from(districtPivot.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .map(([district, entry]) => [
          district,
          entry.delivered,
          entry.pending,
          entry.received,
          entry.warrantyValid,
          entry.warrantyExpired,
          entry.total,
          entry.total > 0 ? Number(((entry.delivered / entry.total) * 100).toFixed(1)) : 0,
        ]);

      if (pivotRows.length === 0) {
        pivotRows.push(["No district data", 0, 0, 0, 0, 0, 0, 0]);
      } else {
        const totals = pivotRows.reduce(
          (acc, row) => {
            acc.delivered += Number(row[1]);
            acc.pending += Number(row[2]);
            acc.received += Number(row[3]);
            acc.warrantyValid += Number(row[4]);
            acc.warrantyExpired += Number(row[5]);
            acc.total += Number(row[6]);
            return acc;
          },
          {
            delivered: 0,
            pending: 0,
            received: 0,
            warrantyValid: 0,
            warrantyExpired: 0,
            total: 0,
          }
        );
        pivotRows.push([
          "TOTAL",
          totals.delivered,
          totals.pending,
          totals.received,
          totals.warrantyValid,
          totals.warrantyExpired,
          totals.total,
          totals.total > 0 ? Number(((totals.delivered / totals.total) * 100).toFixed(1)) : 0,
        ]);
      }

      const pivotExtraRows: (string | number)[][] = [];
      const pivotSectionMarkers = {
        kpiHeader: 0,
        kpiStart: 0,
        topTechHeader: 0,
        topTechStart: 0,
      };

      pivotSectionMarkers.kpiHeader = pivotExtraRows.length;
      pivotExtraRows.push(pivotPadRow(["Key Metrics", "Value"]));
      pivotSectionMarkers.kpiStart = pivotExtraRows.length;
      kpiRows.forEach((row) => pivotExtraRows.push(pivotPadRow(row)));
      pivotExtraRows.push(Array(pivotHeaders.length).fill(""));

      pivotSectionMarkers.topTechHeader = pivotExtraRows.length;
      pivotExtraRows.push(pivotPadRow(["Top Technicians", "Cases", "Success Rate %"]));
      pivotSectionMarkers.topTechStart = pivotExtraRows.length;
      topTechnicians.forEach((row) => pivotExtraRows.push(pivotPadRow(row)));
      pivotExtraRows.push(Array(pivotHeaders.length).fill(""));

      const {
        data: pivotSheetData,
        headerRowIndex: pivotHeaderRow,
        merges: pivotMerges,
        titleRows: pivotTitleRows,
      } = buildSheetMatrix({
        title: "Executive Pivot Dashboard",
        subtitle: "District delivery + warranty mix",
        headers: pivotHeaders,
        rows: pivotRows,
        extraRows: pivotExtraRows,
      });

      const pivotSheet = XLSX.utils.aoa_to_sheet(pivotSheetData);
      pivotSheet["!merges"] = [...(pivotSheet["!merges"] ?? []), ...pivotMerges];
      applyExcelBranding(pivotSheet, {
        headerRow: pivotHeaderRow,
        totalRows: pivotRows.length ? [pivotSheetData.length - 1] : [],
        columnWidths: [24, 14, 14, 14, 16, 16, 16, 18],
        accentColor: "FF0F172A",
        titleRows: pivotTitleRows,
        headerPalette: ["FF0EA5E9", "FF6366F1", "FF10B981"],
        heroFill: "FF0F172A",
        subtitleFill: "FFE0F2FE",
        zebraFills: ["FFF8FAFC", "FFF1F5F9"],
        freezePane: { xSplit: 0, ySplit: pivotHeaderRow + 1 },
      });

      const extraRowStartIndex = pivotHeaderRow - pivotExtraRows.length;
      const styleSectionHeader = (rowIdx: number, fill: string) => {
        for (let c = 0; c < pivotHeaders.length; c++) {
          const ref = XLSX.utils.encode_cell({ r: rowIdx, c });
          const cell = pivotSheet[ref];
          if (!cell) continue;
          cell.s = {
            ...cell.s,
            font: { ...(cell.s?.font ?? {}), bold: true, color: { rgb: "FFFFFFFF" } },
            alignment: { horizontal: "left", vertical: "center" },
            fill: { patternType: "solid", fgColor: { rgb: fill } },
            border: { top: baseBorder, bottom: baseBorder, left: baseBorder, right: baseBorder },
          };
        }
      };

      const styleSectionBody = (start: number, end: number) => {
        for (let r = start; r <= end; r++) {
          for (let c = 0; c < pivotHeaders.length; c++) {
            const ref = XLSX.utils.encode_cell({ r, c });
            const cell = pivotSheet[ref];
            if (!cell) continue;
            cell.s = {
              ...cell.s,
              font: { ...(cell.s?.font ?? {}), color: { rgb: "FF0F172A" } },
              alignment: { horizontal: c === 0 ? "left" : "center", vertical: "center" },
              fill: { patternType: "solid", fgColor: { rgb: "FFF1F5F9" } },
              border: { top: baseBorder, bottom: baseBorder, left: baseBorder, right: baseBorder },
            };
          }
        }
      };

      const kpiHeaderRowIndex = extraRowStartIndex + pivotSectionMarkers.kpiHeader;
      const kpiBodyStart = extraRowStartIndex + pivotSectionMarkers.kpiStart;
      const kpiBodyEnd = kpiBodyStart + kpiRows.length - 1;
      styleSectionHeader(kpiHeaderRowIndex, "FF0EA5E9");
      if (kpiRows.length > 0) {
        styleSectionBody(kpiBodyStart, kpiBodyEnd);
      }

      const topTechHeaderRowIndex = extraRowStartIndex + pivotSectionMarkers.topTechHeader;
      const topTechBodyStart = extraRowStartIndex + pivotSectionMarkers.topTechStart;
      const topTechBodyEnd = topTechBodyStart + topTechnicians.length - 1;
      styleSectionHeader(topTechHeaderRowIndex, "FF8B5CF6");
      styleSectionBody(topTechBodyStart, topTechBodyEnd);

      XLSX.utils.book_append_sheet(workbook, pivotSheet, "Executive Pivot");
      
      // Technician Performance Sheet
      const techHeaders = ["Technician", "Service Center", "Total Cases", "Delivered", "Pending", "Warranty Valid", "Warranty Expired", "Spare Parts Used", ...allProductNames, "Success Rate %"];
      const techRows = technicianPerformance.map((tech) => {
        const successRate = tech.totalCases > 0
          ? ((tech.deliveredCases / tech.totalCases) * 100).toFixed(1)
          : "0";
        const productCounts = allProductNames.map(productName => 
          tech.productsByName.get(productName) || 0
        );
        return [
          tech.name || "Unknown",
          tech.serviceCenter || "-",
          tech.totalCases,
          tech.deliveredCases,
          tech.pendingCases,
          tech.warrantyValid,
          tech.warrantyExpired,
          tech.sparePartsUsed,
          ...productCounts,
          parseFloat(successRate)
        ];
      });
      
      // Add totals row
      const totals = technicianPerformance.reduce((acc, tech) => {
        acc.totalCases += tech.totalCases;
        acc.deliveredCases += tech.deliveredCases;
        acc.pendingCases += tech.pendingCases;
        acc.warrantyValid += tech.warrantyValid;
        acc.warrantyExpired += tech.warrantyExpired;
        acc.sparePartsUsed += tech.sparePartsUsed;
        // Calculate product totals
        allProductNames.forEach(productName => {
          if (!acc.products) acc.products = {};
          acc.products[productName] = (acc.products[productName] || 0) + (tech.productsByName.get(productName) || 0);
        });
        return acc;
      }, {
        totalCases: 0,
        deliveredCases: 0,
        pendingCases: 0,
        warrantyValid: 0,
        warrantyExpired: 0,
        sparePartsUsed: 0,
        products: {} as Record<string, number>
      });
      
      const overallSuccessRate = totals.totalCases > 0
        ? ((totals.deliveredCases / totals.totalCases) * 100).toFixed(1)
        : "0";
      
      const productTotals = allProductNames.map(productName => 
        totals.products?.[productName] || 0
      );
      
      techRows.push([
        "TOTAL",
        "-",
        totals.totalCases,
        totals.deliveredCases,
        totals.pendingCases,
        totals.warrantyValid,
        totals.warrantyExpired,
        totals.sparePartsUsed,
        ...productTotals,
        parseFloat(overallSuccessRate)
      ]);
      
      const {
        data: techData,
        headerRowIndex: techHeaderRow,
        merges: techMerges,
        titleRows: techTitleRows,
      } = buildSheetMatrix({
        title: "Technician Performance",
        subtitle: "Delivery output & warranty mix",
        headers: techHeaders,
        rows: techRows,
      });
      const techSheet = XLSX.utils.aoa_to_sheet(techData);
      techSheet["!merges"] = [...(techSheet["!merges"] ?? []), ...techMerges];
      applyExcelBranding(techSheet, {
        headerRow: techHeaderRow,
        totalRows: [techData.length - 1],
        columnWidths: techHeaders.map((_, index) => {
          if (index === 0) return 28;
          if (index === 1) return 20;
          return 14;
        }),
        accentColor: "FF0EA5E9",
        titleRows: techTitleRows,
        freezePane: { xSplit: 1, ySplit: techHeaderRow + 1 },
        headerPalette: ["FF0EA5E9", "FF22D3EE", "FF38BDF8", "FF06B6D4"],
        heroFill: "FF0F172A",
        subtitleFill: "FFE0F2FE",
        zebraFills: ["FFEFF8FF", "FFDFF3FF"],
      });
      XLSX.utils.book_append_sheet(workbook, techSheet, "Technician Performance");
      
      // District Performance Sheet
      const districtHeaders = ["District", "Total Cases", "Delivered", "Pending", "Delivery Rate %"];
      const districtRows = districtPerformance.map((district) => {
        const deliveryRate = district.totalCases > 0
          ? ((district.delivered / district.totalCases) * 100).toFixed(1)
          : "0";
        return [
          district.district || "Unknown",
          district.totalCases,
          district.delivered,
          district.pending,
          parseFloat(deliveryRate)
        ];
      });
      
      // Add totals row
      const districtTotals = districtPerformance.reduce((acc, district) => {
        acc.totalCases += district.totalCases;
        acc.delivered += district.delivered;
        acc.pending += district.pending;
        return acc;
      }, {
        totalCases: 0,
        delivered: 0,
        pending: 0
      });
      
      const overallDeliveryRate = districtTotals.totalCases > 0
        ? ((districtTotals.delivered / districtTotals.totalCases) * 100).toFixed(1)
        : "0";
      
      districtRows.push([
        "TOTAL",
        districtTotals.totalCases,
        districtTotals.delivered,
        districtTotals.pending,
        parseFloat(overallDeliveryRate)
      ]);
      
      const {
        data: districtData,
        headerRowIndex: districtHeaderRow,
        merges: districtMerges,
        titleRows: districtTitleRows,
      } = buildSheetMatrix({
        title: "District Performance",
        subtitle: "Delivery rate by geography",
        headers: districtHeaders,
        rows: districtRows,
      });
      const districtSheet = XLSX.utils.aoa_to_sheet(districtData);
      districtSheet["!merges"] = [...(districtSheet["!merges"] ?? []), ...districtMerges];
      applyExcelBranding(districtSheet, {
        headerRow: districtHeaderRow,
        totalRows: [districtData.length - 1],
        columnWidths: [24, 16, 16, 16, 18],
        accentColor: "FF6366F1",
        titleRows: districtTitleRows,
        freezePane: { xSplit: 0, ySplit: districtHeaderRow + 1 },
        headerPalette: ["FF6366F1", "FF8B5CF6", "FF22D3EE"],
        heroFill: "FF312E81",
        subtitleFill: "FFEFF6FF",
        zebraFills: ["FFE8F0FF", "FFDDEBFF"],
      });
      XLSX.utils.book_append_sheet(workbook, districtSheet, "District Performance");
      
      // Spare Parts Usage Sheet
      const partsHeaders = ["Part Name", "Used", "Remaining", "Total", "Usage Rate %"];
      const partsRows = sparePartsSummary.map((part) => {
        const total = part.used + part.remaining;
        const usageRate = total > 0 ? ((part.used / total) * 100).toFixed(1) : "0";
        return [
          part.name || "Unknown",
          part.used,
          part.remaining,
          total,
          parseFloat(usageRate)
        ];
      });
      
      // Add totals row
      const partsTotals = sparePartsSummary.reduce((acc, part) => {
        const total = part.used + part.remaining;
        acc.used += part.used;
        acc.remaining += part.remaining;
        acc.total += total;
        return acc;
      }, {
        used: 0,
        remaining: 0,
        total: 0
      });
      
      const overallUsageRate = partsTotals.total > 0
        ? ((partsTotals.used / partsTotals.total) * 100).toFixed(1)
        : "0";
      
      partsRows.push([
        "TOTAL",
        partsTotals.used,
        partsTotals.remaining,
        partsTotals.total,
        parseFloat(overallUsageRate)
      ]);
      
      const {
        data: partsData,
        headerRowIndex: partsHeaderRow,
        merges: partsMerges,
        titleRows: partsTitleRows,
      } = buildSheetMatrix({
        title: "Spare Parts Usage",
        subtitle: "Inventory pulse & consumption",
        headers: partsHeaders,
        rows: partsRows,
      });
      const partsSheet = XLSX.utils.aoa_to_sheet(partsData);
      partsSheet["!merges"] = [...(partsSheet["!merges"] ?? []), ...partsMerges];
      applyExcelBranding(partsSheet, {
        headerRow: partsHeaderRow,
        totalRows: [partsData.length - 1],
        columnWidths: [28, 14, 14, 14, 18],
        accentColor: "FF10B981",
        titleRows: partsTitleRows,
        freezePane: { xSplit: 0, ySplit: partsHeaderRow + 1 },
        headerPalette: ["FF10B981", "FF34D399", "FF6EE7B7"],
        heroFill: "FF064E3B",
        subtitleFill: "FFDCFCE7",
        zebraFills: ["FFEFFFF6", "FFE2F9F0"],
      });
      XLSX.utils.book_append_sheet(workbook, partsSheet, "Spare Parts Usage");
      
      // Case Status Distribution Sheet
      const statusData = [
        ["Category", "Status", "Count", "Percentage"],
        ["Case", "Delivered", deliveredCount, asPercentage(deliveredCount, cases.length)],
        ["Case", "Pending", pendingCount, asPercentage(pendingCount, cases.length)],
        ["Case", "Total", cases.length, 100],
        ["Warranty", "Valid", warrantyValidCount, asPercentage(warrantyValidCount, cases.length)],
        ["Warranty", "Expired", warrantyExpiredCount, asPercentage(warrantyExpiredCount, cases.length)],
        ["Warranty", "Total", cases.length, 100],
      ];
      
      const {
        data: statusSheetData,
        headerRowIndex: statusHeaderRow,
        merges: statusMerges,
        titleRows: statusTitleRows,
      } = buildSheetMatrix({
        title: "Status Distribution",
        subtitle: "Case & warranty breakdown",
        headers: statusData[0],
        rows: statusData.slice(1),
      });
      const statusSheet = XLSX.utils.aoa_to_sheet(statusSheetData);
      statusSheet["!merges"] = [...(statusSheet["!merges"] ?? []), ...statusMerges];
      applyExcelBranding(statusSheet, {
        headerRow: statusHeaderRow,
        totalRows: [statusHeaderRow + 1 + 3, statusHeaderRow + 1 + 6],
        columnWidths: [18, 22, 14, 16],
        accentColor: "FFEC4899",
        titleRows: statusTitleRows,
        freezePane: { xSplit: 0, ySplit: statusHeaderRow + 1 },
        headerPalette: ["FFEC4899", "FFF472B6", "FFF97316"],
        heroFill: "FF831843",
        subtitleFill: "FFFDE7F3",
        zebraFills: ["FFFFF1F9", "FFFFE4F3"],
      });
      XLSX.utils.book_append_sheet(workbook, statusSheet, "Status Distribution");
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `Weekly_Report_${timestamp}.xlsx`;
      
      // Write the file
      XLSX.writeFile(workbook, filename);
      toast.success("Excel report downloaded successfully!");
    } catch (error) {
      console.error("Error generating Excel report:", error);
      toast.error("Failed to generate Excel report. Please try again.");
    }
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground">View performance reports</p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                Reports are only available to administrators.
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-gradient-to-r from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-800/40 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent">
              Reports & Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1 text-lg">
              View performance metrics and analytics 📊
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className={`gap-2 transition-all duration-200 ${
                showFilters
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl"
                  : "bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-gradient-to-r hover:from-purple-500 hover:to-pink-500 hover:text-white hover:border-transparent shadow-sm hover:shadow-md"
              }`}
            >
              <Calendar className="h-4 w-4" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </Button>
            <Button 
              onClick={handleDownloadPDF} 
              className="gap-2 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
            <Button 
              onClick={handleDownloadExcel} 
              variant="outline" 
              className="gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-transparent shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Download Excel
            </Button>
          </div>
        </div>

        {/* Date Range Filters */}
        {showFilters && (
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-rose-500/5" />
            <CardHeader className="relative z-10 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Date Range Filter
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300 mt-1">
                Filter reports by date range. Leave empty to show all data.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-200 font-medium">Start Date</Label>
                  <DatePicker
                    date={startDate}
                    onSelect={(date) => setStartDate(date)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-200 font-medium">End Date</Label>
                  <DatePicker
                    date={endDate}
                    onSelect={(date) => setEndDate(date)}
                  />
                </div>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={handleClearFilters}
                    className="w-full gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-gradient-to-r hover:from-purple-500 hover:to-pink-500 hover:text-white hover:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <X className="h-4 w-4" />
                    Clear Filters
                  </Button>
                </div>
              </div>
              {(startDate || endDate) && (
                <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
                  <span className="font-medium">Active Filters: </span>
                  {startDate && (
                    <span>From {startDate.toLocaleDateString()}</span>
                  )}
                  {startDate && endDate && <span> to </span>}
                  {endDate && (
                    <span>{endDate.toLocaleDateString()}</span>
                  )}
                  <span className="ml-2 text-muted-foreground">
                    ({cases.length} case{cases.length !== 1 ? "s" : ""} found)
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">

        {/* Technician Performance */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-rose-500/5" />
          <CardHeader className="relative z-10 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Technician Performance
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300 mt-1">
              Performance metrics for all technicians with product breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 pt-6">
            <div className="border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-x-auto shadow-inner">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-rose-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
                    <TableHead className={`${tableHeaderClass} sticky left-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 z-10 border-r border-gray-200/50 dark:border-gray-700/50`}>
                      Technician
                    </TableHead>
                    <TableHead className={tableHeaderClass}>Service Center</TableHead>
                    <TableHead className={tableHeaderClass}>Total Cases</TableHead>
                    <TableHead className={tableHeaderClass}>Delivered</TableHead>
                    <TableHead className={tableHeaderClass}>Pending</TableHead>
                    <TableHead className={tableHeaderClass}>Warranty Valid</TableHead>
                    <TableHead className={tableHeaderClass}>Warranty Expired</TableHead>
                    <TableHead className={tableHeaderClass}>Parts Used</TableHead>
                    {allProductNames.map((productName) => (
                      <TableHead key={productName} className="h-12 text-sm font-bold py-3 px-4 min-w-[120px] text-gray-700 dark:text-gray-200">
                        {productName}
                      </TableHead>
                    ))}
                    <TableHead className={tableHeaderClass}>Success Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {technicianPerformance.map((tech, index) => {
                    const successRate =
                      tech.totalCases > 0
                        ? ((tech.deliveredCases / tech.totalCases) * 100).toFixed(1)
                        : "0";
                    return (
                      <TableRow 
                        key={tech.id} 
                        className="hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 dark:hover:from-purple-900/10 dark:hover:to-pink-900/10 transition-all duration-200 border-b border-gray-100 dark:border-gray-800"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <TableCell className="py-3 px-4 text-sm font-semibold sticky left-0 bg-background z-10 text-gray-800 dark:text-gray-200 border-r border-gray-200/50 dark:border-gray-700/50">
                          {tech.name}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{tech.serviceCenter || "-"}</TableCell>
                        <TableCell className="py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">{tech.totalCases}</TableCell>
                        <TableCell className="py-3 px-4">
                          <Badge className="text-xs py-1 px-3 shadow-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                            {tech.deliveredCases}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Badge className="text-xs py-1 px-3 shadow-sm bg-gradient-to-r from-red-500 to-rose-500 text-white">
                            {tech.pendingCases}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Badge className="text-xs py-1 px-3 shadow-sm bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                            {tech.warrantyValid}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Badge className="text-xs py-1 px-3 shadow-sm bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                            {tech.warrantyExpired}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-sm font-medium text-violet-600 dark:text-violet-400">{tech.sparePartsUsed}</TableCell>
                        {allProductNames.map((productName) => {
                          const count = tech.productsByName.get(productName) || 0;
                          return (
                            <TableCell key={productName} className="py-3 px-4 text-center">
                              {count > 0 ? (
                                <Badge className="text-xs py-1 px-2 shadow-sm bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                                  {count}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="py-3 px-4">
                          <Badge
                            className={`text-xs py-1 px-3 shadow-sm ${
                              parseFloat(successRate) >= 80
                                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                                : parseFloat(successRate) >= 60
                                ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-white"
                                : "bg-gradient-to-r from-red-500 to-rose-500 text-white"
                            }`}
                          >
                            {successRate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* District Performance */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-teal-500/5" />
          <CardHeader className="relative z-10 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              District Performance
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300 mt-1">
              Performance metrics by district
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 pt-6">
            <div className="border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-hidden shadow-inner">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-teal-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
                    <TableHead className={tableHeaderClass}>District</TableHead>
                    <TableHead className={tableHeaderClass}>Total Cases</TableHead>
                    <TableHead className={tableHeaderClass}>Delivered</TableHead>
                    <TableHead className={tableHeaderClass}>Pending</TableHead>
                    <TableHead className={tableHeaderClass}>Delivery Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {districtPerformance.map((district, index) => {
                    const deliveryRate =
                      district.totalCases > 0
                        ? ((district.delivered / district.totalCases) * 100).toFixed(1)
                        : "0";
                    return (
                      <TableRow 
                        key={district.district} 
                        className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-cyan-50/50 dark:hover:from-blue-900/10 dark:hover:to-cyan-900/10 transition-all duration-200 border-b border-gray-100 dark:border-gray-800"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <TableCell className="py-3 px-4 text-sm font-semibold text-gray-800 dark:text-gray-200">{district.district}</TableCell>
                        <TableCell className="py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">{district.totalCases}</TableCell>
                        <TableCell className="py-3 px-4">
                          <Badge className="text-xs py-1 px-3 shadow-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                            {district.delivered}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Badge className="text-xs py-1 px-3 shadow-sm bg-gradient-to-r from-red-500 to-rose-500 text-white">
                            {district.pending}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Badge
                            className={`text-xs py-1 px-3 shadow-sm ${
                              parseFloat(deliveryRate) >= 80
                                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                                : parseFloat(deliveryRate) >= 60
                                ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-white"
                                : "bg-gradient-to-r from-red-500 to-rose-500 text-white"
                            }`}
                          >
                            {deliveryRate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Spare Parts Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Spare Parts Usage Summary</CardTitle>
            <CardDescription>Spare parts consumption and remaining stock</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className={tableHeaderClass}>Part Name</TableHead>
                    <TableHead className={tableHeaderClass}>Used</TableHead>
                    <TableHead className={tableHeaderClass}>Remaining</TableHead>
                    <TableHead className={tableHeaderClass}>Total</TableHead>
                    <TableHead className={tableHeaderClass}>Usage Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sparePartsSummary.map((part, index) => {
                    const total = part.used + part.remaining;
                    const usageRate = total > 0 ? ((part.used / total) * 100).toFixed(1) : "0";
                    return (
                      <TableRow key={index} className="hover:bg-muted/30">
                        <TableCell className="py-2 px-3 text-xs font-medium">{part.name}</TableCell>
                        <TableCell className="py-2 px-3 text-xs">{part.used}</TableCell>
                        <TableCell className="py-2 px-3 text-xs">{part.remaining}</TableCell>
                        <TableCell className="py-2 px-3 text-xs">{total}</TableCell>
                        <TableCell className="py-2 px-3">
                          <Badge variant="outline" className="text-xs py-0.5 px-2">{usageRate}%</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
