"""Sequential meridional ray trace through a real lens prescription (patent data).
Proves the chain: prescription -> ray trace -> focal length -> focus by moving glass -> spot size.
Run: python3 trace.py   (asserts EFL/BFL against the Zemax values shipped with the prescription)
"""
import math

# Bertele 1934 Sonnar 9.2cm f/1.5 (US 1,975,678), from nzhagen/LensLibrary, mm. (radius, thickness to next surface, n after surface)
# radius 0 = flat; the stop is a flat surface with n=1.
SONNAR = [(60.61502,10.5,1.6375),(416.77,.5,1),(37.26,11.7,1.6727),(104.34,7.6,1.4675),(-247,1.9,1.689),(22.14,11.95,1),
          (0,1.95,1),(1904,3.4,1.5481),(59.85,22.4,1.6578),(-22.06,8.4,1.5488),(-89.06,34.75113,1)]
BFL_ZMX,EFL_ZMX=34.75113,92.55012

def trace(surfs,y,u,z0=0.0):
    """Ray at height y, slope angle u (rad), starting at axial position z0 (surface 1 vertex = 0).
    Returns (y,u,z) after the last surface. Exact Snell at each spherical surface."""
    n=1.0; z=z0; zv=0.0
    for R,t,n2 in surfs:
        # move ray to this surface: intersect line (y + tan(u)*(z'-z)) with sphere of radius R at vertex zv
        dz=zv-z; y=y+math.tan(u)*dz; z=zv
        if R!=0:
            c=1/R; d=(math.cos(u),math.sin(u))            # direction
            # sphere centre at (zv+R,0); solve |p + s d - C|^2 = R^2 with p=(zv,y)
            px,py=-R,y; b=px*d[0]+py*d[1]; disc=b*b-(px*px+py*py-R*R)
            if disc<0: return None
            s=-b-math.copysign(math.sqrt(disc),R)         # nearest vertex-side intersection
            z+=s*d[0]; y+=s*d[1]
            nx,ny=-(z-(zv+R))/R,-y/R                      # surface normal pointing along +z (direction of travel)
            th_i=math.atan2(d[1],d[0])-math.atan2(ny,nx)  # incidence angle vs normal
            sin_t=n/n2*math.sin(th_i)
            if abs(sin_t)>1: return None
            u=math.atan2(ny,nx)+math.asin(sin_t)
        else:
            u=math.asin(n/n2*math.sin(u))                 # flat surface
        n=n2; zv+=t
    return y,u,z                                          # z is at last surface; image plane is at zv

def axis_crossing(surfs,y,u,z0=0.0):
    r=trace(surfs,y,u,z0)
    if r is None: return None
    y1,u1,z1=r
    return z1-y1/math.tan(u1)                             # where the ray meets the axis (absolute z)

def efl_bfl(surfs):
    h=1e-3
    zc=axis_crossing(surfs,h,0.0)
    y1,u1,z1=trace(surfs,h,0.0)
    last_vertex=sum(t for _,t,_ in surfs[:-1])
    return h/-math.tan(u1), zc-last_vertex               # EFL = h/(-u'), BFL from last vertex

def focus_extension(surfs,obj_dist,h=1e-3):
    """Unit focusing: the whole lens moves forward by d so a paraxial ray from an on-axis point obj_dist in front of the
    SENSOR (sensor fixed at the infinity position, like a real focus ring scale) lands on the sensor."""
    L=sum(t for _,t,_ in surfs)                          # track: surface 1 vertex -> sensor at infinity focus
    lo,hi=0.0,50.0
    for _ in range(60):
        d=(lo+hi)/2; u=math.atan(h/(obj_dist-L-d))        # lens moved out by d: object is obj_dist-L-d from surface 1
        zc=axis_crossing(surfs,h,u)                       # crossing, measured from the moved surface 1
        (lo,hi)=(d,hi) if zc>L+d else (lo,d)              # image beyond the sensor -> move the lens further out
    return d

def spot_radius(surfs,obj_dist,d,N,n_rays=40):
    """On-axis geometric spot radius on the image plane (rays fill the entrance pupil f/N)."""
    f,_=efl_bfl(surfs); pupil=f/N/2; L=sum(t for _,t,_ in surfs)
    ys=[]
    for k in range(1,n_rays+1):
        h=pupil*k/n_rays
        u=0.0 if obj_dist==math.inf else math.atan(h/(obj_dist-L-d))
        r=trace(surfs,h,u)
        if r is None: continue
        y1,u1,z1=r; ys.append(abs(y1+math.tan(u1)*(L+d-z1)))   # height where the ray meets the sensor (at L+d from surface 1)
    return max(ys)

if __name__=='__main__':
    f,bfl=efl_bfl(SONNAR)
    print(f'EFL {f:.3f} mm (Zemax {EFL_ZMX})   BFL {bfl:.3f} mm (Zemax {BFL_ZMX})')
    assert abs(f-EFL_ZMX)<0.05 and abs(bfl-BFL_ZMX)<0.05
    for D in (math.inf,3000,1000):
        d=0.0 if D==math.inf else focus_extension(SONNAR,D)
        print(f'object {D:>6} mm -> lens extension {d:6.3f} mm, on-axis spot radius f/1.5 {spot_radius(SONNAR,D,d,1.5)*1e3:6.1f} µm, f/8 {spot_radius(SONNAR,D,d,8)*1e3:5.1f} µm')
    d=focus_extension(SONNAR,1000)
    assert 7<d<14, d                                      # thin-lens estimate f^2/(D-f) ~ 10 mm
    print('ok')
