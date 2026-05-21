const fs = require('fs')
const path = require('path')

const envFilePath = path.resolve('.env')
const envExamplePath = path.resolve('.env.example')

const packDate = new Date().toISOString().slice(0, 10).replaceAll('-', '')
const versionLine = `VITE_APP_VERSION=${packDate}`
const contentToAppend = `\n${versionLine}`
let envContent = ''

if (fs.existsSync(envFilePath)) {
  envContent = fs.readFileSync(envFilePath, 'utf-8')
}
else if (fs.existsSync(envExamplePath)) {
  envContent = fs.readFileSync(envExamplePath, 'utf-8')
}

const versionRegex = /^VITE_APP_VERSION=.*$/m
if (versionRegex.test(envContent)) {
  envContent = envContent.replace(versionRegex, versionLine)
}
else {
  envContent = envContent + contentToAppend
}

fs.writeFileSync(envFilePath, envContent)

console.warn('update to .env file.', contentToAppend)
