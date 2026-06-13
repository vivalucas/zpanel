const fs = require('fs')
const path = require('path')

const packDate = new Date().toISOString().slice(0, 10).replaceAll('-', '')
const versionFilePath = path.resolve('.zpanel-build-version')

fs.writeFileSync(versionFilePath, `${packDate}\n`)

console.warn('update frontend build version file.', packDate)
