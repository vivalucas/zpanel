const fs = require('fs')
const path = require('path')

const { version } = require('../package.json')
const backendVersion = fs.readFileSync(path.resolve('service/assets/version'), 'utf8').trim().split('|')[1]
if (version !== backendVersion)
  throw new Error(`Frontend version ${version} does not match backend version ${backendVersion}`)

fs.writeFileSync(path.resolve('.zpanel-build-version'), `${version}\n`)
console.warn('Frontend build version:', version)
