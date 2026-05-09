import { VerticalLayout } from '@/layouts/VerticalLayout';
import { restaurantManifest } from '../manifest';

export const RestaurantLayout = () => {
    return <VerticalLayout manifest={restaurantManifest} />;
};
