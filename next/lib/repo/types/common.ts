export interface Place {
  street?: string;
  province?: string;
  provinceId?: string;
  district?: string;
  districtId?: string;
  ward?: string;
  wardId?: string;
  fullAddress?: string;
  location?: any;
  note?: string;
}

export interface Owner {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

export type Trace = {
  ip: string;
  location?: any;
  geoHash?: string;
};
