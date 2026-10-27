import { apiClient, apiErrorMessage, unwrapApiData } from '@/lib/api-client'

export async function updatePatientProfileByStaff(id: string, dto: Record<string, any>) {
  try {
    const response = await apiClient.patch(`/patient-profiles/${id}`, dto)
    return unwrapApiData(response.data)
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Không thể cập nhật hồ sơ bệnh nhân.'))
  }
}
