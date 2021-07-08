import { document } from '../utils/dynamodbClient'

export const handle = async (event) => {
    const certificates = await document.scan({
        TableName: 'users_certificates'
    })

    return {
        statusCode: 201,
        body: JSON.stringify({
            data: certificates
        })
    }
}