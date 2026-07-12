const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/Drivers.tsx',
  'src/pages/FuelExpenses.tsx',
  'src/pages/Maintenance.tsx',
  'src/pages/Reports.tsx',
  'src/pages/Trips.tsx',
  'src/pages/Vehicles.tsx',
  'src/components/Layout.tsx',
  'src/contexts/AuthContext.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // 1. Add import ErrorBanner if not exists
  if (!content.includes('ErrorBanner')) {
    const importStr = file.includes('components') || file.includes('contexts') ? 
       'import { ErrorBanner } from \'../components/ErrorBanner\';\n' : 
       'import { ErrorBanner } from \'../components/ErrorBanner\';\n';
    content = content.replace(/(import .* from ['\"].*['\"];?\n)/, '$1' + importStr);
  }

  // 2. Add const [error, setError]
  if (!content.includes('const [error, setError]')) {
    content = content.replace(/const \[loading, setLoading\] = useState\(true\)/g, 'const [loading, setLoading] = useState(true)\n  const [error, setError] = useState<string | null>(null)');
  }
  // Layout and AuthContext might have different state init
  if (file.includes('Layout.tsx') && !content.includes('const [error, setError]')) {
    content = content.replace(/const \[isSearching, setIsSearching\] = useState\(false\)/, 'const [isSearching, setIsSearching] = useState(false)\n  const [error, setError] = useState<string | null>(null)');
  }
  if (file.includes('AuthContext.tsx') && !content.includes('const [error, setError]')) {
    content = content.replace(/const \[loading, setLoading\] = useState\(true\)/, 'const [loading, setLoading] = useState(true)\n  const [error, setError] = useState<string | null>(null)');
  }

  // 3. Add setError in catch block
  content = content.replace(/catch \((err|e)\) \{\s*(.*?console\.error.*?\n)/g, 'catch ($1: any) {\n      $2      setError($1.message || \'Something went wrong\')\n');

  // 4. Inject <ErrorBanner message={error} />
  if (!content.includes('<ErrorBanner')) {
    if (file.includes('pages')) {
      content = content.replace(/(<p className=\"text-sm text-muted-foreground mt-1\">.*?<\/p>\s*<\/div>\s*(?:<Button.*?>.*?<\/Button>\s*)?<\/div>)/, '$1\n      <ErrorBanner message={error} />');
    } else if (file.includes('Layout.tsx')) {
      // In Layout, put it inside the search overlay or under the header
      content = content.replace(/(<Command className=\"rounded-lg border shadow-md relative\">)/, '$1\n            <ErrorBanner message={error} />');
    } else if (file.includes('AuthContext.tsx')) {
      // Doesn't render UI directly except children, wait. AuthContext catch block is in fetchRole.
    }
  }

  fs.writeFileSync(file, content, 'utf8');
}
