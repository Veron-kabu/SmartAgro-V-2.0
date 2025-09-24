import UserDashboard from './UserDashboard'

export default function FarmerDashboard() {
  return (
    <UserDashboard expectedRole="farmer" title="Farmer Profile" fallbackName="Farmer" />
  )
}
