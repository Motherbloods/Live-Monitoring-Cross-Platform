import { hashPassword } from '../src/utils/password.js'

const readHidden = (question) =>
  new Promise((resolve) => {
    const stdin = process.stdin
    if (!stdin.isTTY) {
      let data = ''
      stdin.setEncoding('utf8')
      stdin.on('data', (chunk) => {
        data += chunk
      })
      stdin.on('end', () => resolve(data.split(/\r?\n/)[0]))
      return
    }
    process.stdout.write(question)
    let buffer = ''
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const onData = (char) => {
      if (char === '\r' || char === '\n' || char === '\u0004') {
        stdin.setRawMode(false)
        stdin.pause()
        stdin.off('data', onData)
        process.stdout.write('\n')
        resolve(buffer)
      } else if (char === '\u0003') {
        process.exit(1)
      } else if (char === '\u007f' || char === '\b') {
        buffer = buffer.slice(0, -1)
      } else {
        buffer += char
      }
    }
    stdin.on('data', onData)
  })

const password = await readHidden('Kata sandi admin baru: ')
if (password.length < 10) {
  console.error('Kata sandi minimal 10 karakter.')
  process.exit(1)
}
if (process.stdin.isTTY) {
  const again = await readHidden('Ulangi kata sandi: ')
  if (again !== password) {
    console.error('Kata sandi tidak sama.')
    process.exit(1)
  }
}
console.log('\nSalin baris ini ke file .env:\n')
console.log(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}`)
