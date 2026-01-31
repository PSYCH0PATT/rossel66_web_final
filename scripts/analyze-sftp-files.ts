import * as fs from 'fs';
import * as path from 'path';

interface FileAnalysis {
  filename: string;
  size: number;
  lines: number;
  columns: string[];
  sampleRows: any[];
  date: string | null;
  uniqueValues: Record<string, Set<string>>;
}

function parseDateFromFilename(filename: string): string | null {
  // rossel_playlist_2025_12_05.csv -> 2025-12-05
  const match = filename.match(/(\d{4})_(\d{2})_(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return null;
}

function analyzeCsvFile(filePath: string): FileAnalysis {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const filename = path.basename(filePath);
  
  // Парсим CSV с разделителем ; (точка с запятой)
  const rows: string[][] = [];
  const uniqueValues: Record<string, Set<string>> = {};
  let columns: string[] = [];
  
  lines.forEach((line, index) => {
    // Парсинг CSV с разделителем ;, учитывая кавычки
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ';' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Последнее значение
    
    if (index === 0) {
      // Заголовки
      columns = values;
      columns.forEach(col => {
        uniqueValues[col] = new Set();
      });
    } else if (values.length > 0 && values[0]) {
      // Данные
      rows.push(values);
      values.forEach((value, colIndex) => {
        const colName = columns[colIndex] || `col_${colIndex}`;
        if (uniqueValues[colName] && value) {
          uniqueValues[colName].add(value);
        }
      });
    }
  });
  
  return {
    filename,
    size: fs.statSync(filePath).size,
    lines: lines.length,
    columns,
    sampleRows: rows.slice(0, 5), // Первые 5 строк данных
    date: parseDateFromFilename(filename),
    uniqueValues: Object.fromEntries(
      Object.entries(uniqueValues).map(([key, set]) => [key, Array.from(set)])
    )
  };
}

async function main() {
  const downloadsDir = './sftp_downloads';
  
  if (!fs.existsSync(downloadsDir)) {
    console.error(`❌ Директория ${downloadsDir} не существует. Сначала запустите download-sftp.ts`);
    process.exit(1);
  }
  
  const files = fs.readdirSync(downloadsDir)
    .filter(file => file.endsWith('.csv'))
    .map(file => path.join(downloadsDir, file))
    .sort();
  
  if (files.length === 0) {
    console.error(`❌ CSV файлы не найдены в ${downloadsDir}`);
    process.exit(1);
  }
  
  console.log(`📊 Анализирую ${files.length} файлов...\n`);
  
  const analyses: FileAnalysis[] = [];
  
  for (const file of files) {
    try {
      console.log(`📄 Анализирую: ${path.basename(file)}`);
      const analysis = analyzeCsvFile(file);
      analyses.push(analysis);
    } catch (error: any) {
      console.error(`❌ Ошибка при анализе ${file}: ${error.message}`);
    }
  }
  
  // Общий анализ
  console.log('\n' + '='.repeat(60));
  console.log('📊 ОБЩИЙ АНАЛИЗ');
  console.log('='.repeat(60));
  
  if (analyses.length > 0) {
    const first = analyses[0];
    console.log(`\n📋 Структура файлов:`);
    console.log(`   Колонки (${first.columns.length}): ${first.columns.join(', ')}`);
    console.log(`   Среднее количество строк: ${Math.round(analyses.reduce((sum, a) => sum + a.lines, 0) / analyses.length)}`);
    
    console.log(`\n📅 Диапазон дат:`);
    const dates = analyses.map(a => a.date).filter(d => d !== null).sort();
    if (dates.length > 0) {
      console.log(`   С: ${dates[0]}`);
      console.log(`   По: ${dates[dates.length - 1]}`);
    }
    
    console.log(`\n📄 Пример данных (из первого файла):`);
    console.log(`   Заголовки: ${first.columns.join(' | ')}`);
    if (first.sampleRows.length > 0) {
      console.log(`   Первая строка данных:`);
      first.sampleRows[0].forEach((value: string, index: number) => {
        console.log(`     ${first.columns[index] || `col_${index}`}: ${value}`);
      });
    }
    
    // Анализ уникальных значений
    console.log(`\n🔍 Уникальные значения (из первого файла):`);
    Object.entries(first.uniqueValues).forEach(([column, values]) => {
      console.log(`   ${column}: ${values.length} уникальных значений`);
      if (values.length <= 10) {
        console.log(`      ${Array.from(values).join(', ')}`);
      } else {
        console.log(`      ${Array.from(values).slice(0, 10).join(', ')} ... (еще ${values.length - 10})`);
      }
    });
    
    // Сохраняем детальный отчет
    const reportPath = './sftp_analysis_report.json';
    fs.writeFileSync(reportPath, JSON.stringify({
      totalFiles: analyses.length,
      dateRange: {
        from: dates[0] || null,
        to: dates[dates.length - 1] || null
      },
      structure: {
        columns: first.columns,
        averageLines: Math.round(analyses.reduce((sum, a) => sum + a.lines, 0) / analyses.length)
      },
      files: analyses.map(a => ({
        filename: a.filename,
        date: a.date,
        lines: a.lines,
        size: a.size
      })),
      sampleData: {
        columns: first.columns,
        firstRow: first.sampleRows[0] || [],
        uniqueValues: first.uniqueValues
      }
    }, null, 2));
    
    console.log(`\n💾 Детальный отчет сохранен в: ${reportPath}`);
  }
  
  console.log('\n✅ Анализ завершен');
}

main();
