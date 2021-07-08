import chromium from 'chrome-aws-lambda'
import { join } from 'path'
import { readFileSync } from 'fs'
import { document } from '../utils/dynamodbClient'
import * as Handlebars from 'handlebars'
import * as dayjs from 'dayjs'
import { S3 } from 'aws-sdk'

interface ICreateCertificate {
    id: string
    name: string
    grade: string
}

interface ITemplate {
    id: string
    name: string
    grade: string
    date: string
    medal: string
}

const compile = async function (data: ITemplate) {
    const filePath = join(process.cwd(), 'src', 'templates', 'certificate.hbs')
    const stream = readFileSync(filePath, 'utf-8')
    return Handlebars.compile(stream)(data)
}

export const handle = async (event) => {
    const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate;

    const queryUserAlreadyExists = await document.query({
        TableName: 'users_certificates',
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: {
            ":id": id
        }
    }).promise()

    const userAlreadyExists = queryUserAlreadyExists.Items[0]

    if (!userAlreadyExists) {
        await document.put({
            TableName: 'users_certificates',
            Item: {
                id,
                name,
                grade
            }
        }).promise()
    }


    const medalPath = join(process.cwd(), 'src', "templates", "selo.png")
    const medal = readFileSync(medalPath, 'base64')

    const content = await compile({
        date: dayjs().format('DD/MM/YYYY'),
        grade,
        id,
        medal,
        name,
    })

    const browser = await chromium.puppeteer.launch({
        headless: true,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        args: chromium.args,
        ignoreHTTPSErrors: true,
    })

    const page = await browser.newPage();

    await page.setContent(content)

    const pdf = await page.pdf({
        format: 'a4',
        landscape: true,
        path: process.env.IS_OFFLINE ? "certificate.pdf" : null,
        printBackground: true,
        preferCSSPageSize: true
    })

    await browser.close()

    const s3 = new S3()

    await s3.putObject({
        Bucket: 'serverlesscertificateignite',
        Key: `${id}.pdf`,
        ACL: 'public-read',
        Body: pdf,
        ContentType: 'application/pdf'
    }).promise()

    return {
        statusCode: 201,
        body: JSON.stringify({
            message: 'Worked'
        })
    }
}