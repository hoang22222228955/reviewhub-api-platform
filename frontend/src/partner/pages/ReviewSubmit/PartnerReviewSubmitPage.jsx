import { useState } from 'react'
import { useAuth } from '../../../auth/context/AuthContext'
import ReviewSubmitForm from '../../components/ReviewSubmitForm/ReviewSubmitForm'
import ReviewPreview from '../../components/ReviewPreview/ReviewPreview'

export default function PartnerReviewSubmitPage() {
  const { currentUser, consumeQuota } = useAuth()
  const [createdReview, setCreatedReview] = useState(null)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 18 }}>
      <ReviewSubmitForm
        partnerName={currentUser?.orgName || currentUser?.businessName || currentUser?.name || 'Đối tác'}
        onSubmitSuccess={(review) => {
          setCreatedReview(review)
          consumeQuota(1)
        }}
      />
      <ReviewPreview review={createdReview} />
    </div>
  )
}
